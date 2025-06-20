import fs from 'fs';
import path from 'path';
import logger from '../utils/logger.js';
import advancedMetrics from '../utils/advancedMetrics.js';

class ABTestingService {
    constructor() {
        this.config = {
            enabled: false,
            splitPercentage: 50, // 50% model A, 50% model B
            minimumSampleSize: 50,
            significanceLevel: 0.05,
            testDuration: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
            stratifiedSampling: true // Balance by user type, image type, etc.
        };
        
        this.activeTests = new Map();
        this.userAssignments = new Map(); // userId -> testGroup
        this.testResults = new Map();
        
        this.loadConfig();
        this.loadActiveTests();
    }

    loadConfig() {
        try {
            const configPath = path.join(process.cwd(), 'storage', 'ab_testing_config.json');
            if (fs.existsSync(configPath)) {
                const configData = fs.readFileSync(configPath, 'utf8');
                this.config = { ...this.config, ...JSON.parse(configData) };
                logger.systemLog('AB_TESTING', 'Configuration loaded successfully');
            }
        } catch (error) {
            logger.errorLog('Failed to load A/B testing config', error);
        }
    }

    saveConfig() {
        try {
            const configPath = path.join(process.cwd(), 'storage', 'ab_testing_config.json');
            fs.writeFileSync(configPath, JSON.stringify(this.config, null, 2));
            logger.systemLog('AB_TESTING', 'Configuration saved successfully');
        } catch (error) {
            logger.errorLog('Failed to save A/B testing config', error);
        }
    }

    loadActiveTests() {
        try {
            const testsPath = path.join(process.cwd(), 'storage', 'active_ab_tests.json');
            if (fs.existsSync(testsPath)) {
                const testsData = fs.readFileSync(testsPath, 'utf8');
                const tests = JSON.parse(testsData);
                
                for (const [testId, testData] of Object.entries(tests)) {
                    this.activeTests.set(testId, {
                        ...testData,
                        startTime: new Date(testData.startTime),
                        endTime: testData.endTime ? new Date(testData.endTime) : null
                    });
                }
                
                logger.systemLog('AB_TESTING', `Loaded ${this.activeTests.size} active tests`);
            }
        } catch (error) {
            logger.errorLog('Failed to load active A/B tests', error);
        }
    }

    saveActiveTests() {
        try {
            const testsPath = path.join(process.cwd(), 'storage', 'active_ab_tests.json');
            const testsObject = {};
            
            for (const [testId, testData] of this.activeTests.entries()) {
                testsObject[testId] = {
                    ...testData,
                    startTime: testData.startTime.toISOString(),
                    endTime: testData.endTime ? testData.endTime.toISOString() : null
                };
            }
            
            fs.writeFileSync(testsPath, JSON.stringify(testsObject, null, 2));
            logger.systemLog('AB_TESTING', 'Active tests saved successfully');
        } catch (error) {
            logger.errorLog('Failed to save active A/B tests', error);
        }
    }

    createTest(testConfig) {
        const testId = `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const test = {
            id: testId,
            name: testConfig.name || `A/B Test ${testId}`,
            description: testConfig.description || 'Comparing model performance',
            modelA: {
                version: testConfig.modelA.version,
                path: testConfig.modelA.path,
                name: testConfig.modelA.name || 'Model A'
            },
            modelB: {
                version: testConfig.modelB.version,
                path: testConfig.modelB.path,
                name: testConfig.modelB.name || 'Model B'
            },
            splitPercentage: testConfig.splitPercentage || this.config.splitPercentage,
            startTime: new Date(),
            endTime: null,
            status: 'running',
            minSampleSize: testConfig.minSampleSize || this.config.minimumSampleSize,
            maxDuration: testConfig.maxDuration || this.config.testDuration,
            metrics: {
                groupA: { predictions: 0, correct: 0, totalConfidence: 0 },
                groupB: { predictions: 0, correct: 0, totalConfidence: 0 }
            },
            stratified: testConfig.stratified !== undefined ? testConfig.stratified : this.config.stratifiedSampling
        };

        this.activeTests.set(testId, test);
        this.saveActiveTests();
        
        logger.systemLog('AB_TESTING', `Created new A/B test: ${testId} (${test.name})`);
        
        return testId;
    }

    assignUserToGroup(userId, testId, requestContext = {}) {
        const test = this.activeTests.get(testId);
        if (!test || test.status !== 'running') {
            return null;
        }

        // Check if user is already assigned
        const existingAssignment = this.userAssignments.get(userId);
        if (existingAssignment && existingAssignment.testId === testId) {
            return existingAssignment.group;
        }

        // Stratified sampling logic
        let group;
        if (test.stratified) {
            group = this.stratifiedAssignment(userId, testId, requestContext);
        } else {
            // Simple random assignment
            const random = this.hashUserId(userId) % 100;
            group = random < test.splitPercentage ? 'A' : 'B';
        }

        this.userAssignments.set(userId, {
            testId: testId,
            group: group,
            assignedAt: new Date(),
            context: requestContext
        });

        logger.systemLog('AB_TESTING', `Assigned user ${userId} to group ${group} for test ${testId}`);
        
        return group;
    }

    stratifiedAssignment(userId, testId, context) {
        // Balance assignment based on various factors
        const factors = {
            timeOfDay: new Date().getHours(),
            dayOfWeek: new Date().getDay(),
            userAgent: context.userAgent ? this.hashString(context.userAgent) % 10 : 0,
            imageSource: context.imageSource || 'unknown' // camera vs upload
        };

        // Create a composite hash from user ID and factors
        const compositeHash = this.hashUserId(userId) + 
                             factors.timeOfDay * 7 + 
                             factors.dayOfWeek * 11 + 
                             factors.userAgent * 13;

        const random = compositeHash % 100;
        const test = this.activeTests.get(testId);
        
        return random < test.splitPercentage ? 'A' : 'B';
    }

    recordPrediction(testId, userId, group, prediction, actualLabel = null, confidence = 0) {
        const test = this.activeTests.get(testId);
        if (!test || test.status !== 'running') {
            return;
        }

        const groupKey = group === 'A' ? 'groupA' : 'groupB';
        test.metrics[groupKey].predictions += 1;
        test.metrics[groupKey].totalConfidence += confidence;

        if (actualLabel !== null) {
            const isCorrect = prediction === actualLabel;
            if (isCorrect) {
                test.metrics[groupKey].correct += 1;
            }
        }

        // Check if test should be concluded
        this.checkTestConclusion(testId);
        
        this.saveActiveTests();
        
        logger.systemLog('AB_TESTING', `Recorded prediction for test ${testId}, group ${group}`);
    }

    checkTestConclusion(testId) {
        const test = this.activeTests.get(testId);
        if (!test || test.status !== 'running') {
            return;
        }

        const totalPredictions = test.metrics.groupA.predictions + test.metrics.groupB.predictions;
        const timePassed = Date.now() - test.startTime.getTime();

        // Check if minimum sample size and time requirements are met
        const hasMinimumSample = totalPredictions >= test.minSampleSize;
        const hasMinimumTime = timePassed >= (24 * 60 * 60 * 1000); // At least 24 hours
        const exceededMaxTime = timePassed >= test.maxDuration;

        if ((hasMinimumSample && hasMinimumTime) || exceededMaxTime) {
            const significance = this.calculateStatisticalSignificance(testId);
            
            if (significance.isSignificant || exceededMaxTime) {
                this.concludeTest(testId, significance);
            }
        }
    }

    calculateStatisticalSignificance(testId) {
        const test = this.activeTests.get(testId);
        const groupA = test.metrics.groupA;
        const groupB = test.metrics.groupB;

        if (groupA.predictions === 0 || groupB.predictions === 0) {
            return { isSignificant: false, pValue: 1, confidenceInterval: null };
        }

        // Calculate accuracy rates
        const accuracyA = groupA.correct / groupA.predictions;
        const accuracyB = groupB.correct / groupB.predictions;

        // Two-proportion z-test
        const pooledRate = (groupA.correct + groupB.correct) / (groupA.predictions + groupB.predictions);
        const standardError = Math.sqrt(pooledRate * (1 - pooledRate) * (1/groupA.predictions + 1/groupB.predictions));
        
        if (standardError === 0) {
            return { isSignificant: false, pValue: 1, confidenceInterval: null };
        }

        const zScore = Math.abs(accuracyA - accuracyB) / standardError;
        const pValue = 2 * (1 - this.normalCDF(Math.abs(zScore)));

        // 95% confidence interval for difference in proportions
        const diff = accuracyA - accuracyB;
        const diffSE = Math.sqrt((accuracyA * (1 - accuracyA) / groupA.predictions) + 
                                (accuracyB * (1 - accuracyB) / groupB.predictions));
        const margin = 1.96 * diffSE;

        return {
            isSignificant: pValue < this.config.significanceLevel,
            pValue: pValue,
            zScore: zScore,
            accuracyA: accuracyA,
            accuracyB: accuracyB,
            difference: diff,
            confidenceInterval: [diff - margin, diff + margin],
            winner: accuracyA > accuracyB ? 'A' : 'B',
            improvement: Math.abs(diff) * 100
        };
    }

    concludeTest(testId, significance) {
        const test = this.activeTests.get(testId);
        if (!test) return;

        test.status = 'completed';
        test.endTime = new Date();
        test.results = significance;

        logger.systemLog('AB_TESTING', `Test ${testId} concluded. Winner: Model ${significance.winner}, Improvement: ${significance.improvement.toFixed(2)}%`);

        // Auto-deploy winner if significant improvement
        if (significance.isSignificant && significance.improvement > 5) {
            this.autoDeployWinner(testId, significance);
        }

        this.saveActiveTests();
    }

    autoDeployWinner(testId, significance) {
        const test = this.activeTests.get(testId);
        const winnerModel = significance.winner === 'A' ? test.modelA : test.modelB;
        
        logger.systemLog('AB_TESTING', `Auto-deploying winner: ${winnerModel.name} (${winnerModel.version})`);
        
        // This would integrate with the model versioning system
        // For now, just log the decision
    }

    getTestResults(testId) {
        const test = this.activeTests.get(testId);
        if (!test) return null;

        const significance = test.status === 'completed' ? 
            test.results : this.calculateStatisticalSignificance(testId);

        return {
            testId: test.id,
            name: test.name,
            status: test.status,
            duration: test.endTime ? 
                test.endTime.getTime() - test.startTime.getTime() : 
                Date.now() - test.startTime.getTime(),
            modelA: test.modelA,
            modelB: test.modelB,
            metrics: test.metrics,
            significance: significance,
            totalPredictions: test.metrics.groupA.predictions + test.metrics.groupB.predictions,
            startTime: test.startTime,
            endTime: test.endTime
        };
    }

    getAllTests() {
        return Array.from(this.activeTests.keys()).map(testId => this.getTestResults(testId));
    }

    // Utility functions
    hashUserId(userId) {
        let hash = 0;
        for (let i = 0; i < userId.length; i++) {
            const char = userId.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash);
    }

    hashString(str) {
        let hash = 0;
        if (!str || str.length === 0) return hash;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash);
    }

    normalCDF(x) {
        // Approximation of the cumulative distribution function for standard normal distribution
        const t = 1 / (1 + 0.2316419 * Math.abs(x));
        const d = 0.3989423 * Math.exp(-x * x / 2);
        let prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
        if (x > 0) prob = 1 - prob;
        return prob;
    }

    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        this.saveConfig();
        logger.systemLog('AB_TESTING', 'Configuration updated');
    }

    stopTest(testId) {
        const test = this.activeTests.get(testId);
        if (test && test.status === 'running') {
            const significance = this.calculateStatisticalSignificance(testId);
            this.concludeTest(testId, significance);
            return true;
        }
        return false;
    }

    deleteTest(testId) {
        const deleted = this.activeTests.delete(testId);
        if (deleted) {
            this.saveActiveTests();
            logger.systemLog('AB_TESTING', `Deleted test ${testId}`);
        }
        return deleted;
    }
}

export default new ABTestingService();