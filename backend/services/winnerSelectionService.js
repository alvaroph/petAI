import logger from '../utils/logger.js';
import modelVersioning from '../utils/modelVersioning.js';
import abTestingService from './abTestingService.js';
import fs from 'fs';
import path from 'path';

class WinnerSelectionService {
    constructor() {
        this.config = {
            autoDeployEnabled: true,
            minimumConfidenceLevel: 0.95, // 95% confidence
            minimumImprovementThreshold: 5.0, // 5% improvement required
            minimumSampleSize: 100,
            minimumTestDuration: 24 * 60 * 60 * 1000, // 24 hours
            rollbackOnFailure: true,
            notificationEnabled: true,
            deploymentStrategy: 'replace', // 'replace', 'canary', 'blue-green'
            canaryPercentage: 10 // For canary deployments
        };

        this.deploymentHistory = [];
        this.loadConfig();
        this.loadDeploymentHistory();
    }

    loadConfig() {
        try {
            const configPath = path.join(process.cwd(), 'storage', 'winner_selection_config.json');
            if (fs.existsSync(configPath)) {
                const configData = fs.readFileSync(configPath, 'utf8');
                this.config = { ...this.config, ...JSON.parse(configData) };
                logger.systemLog('WINNER_SELECTION', 'Configuration loaded');
            }
        } catch (error) {
            logger.errorLog('Failed to load winner selection config', error);
        }
    }

    saveConfig() {
        try {
            const configPath = path.join(process.cwd(), 'storage', 'winner_selection_config.json');
            fs.writeFileSync(configPath, JSON.stringify(this.config, null, 2));
            logger.systemLog('WINNER_SELECTION', 'Configuration saved');
        } catch (error) {
            logger.errorLog('Failed to save winner selection config', error);
        }
    }

    loadDeploymentHistory() {
        try {
            const historyPath = path.join(process.cwd(), 'storage', 'deployment_history.json');
            if (fs.existsSync(historyPath)) {
                const historyData = fs.readFileSync(historyPath, 'utf8');
                this.deploymentHistory = JSON.parse(historyData);
                logger.systemLog('WINNER_SELECTION', `Loaded ${this.deploymentHistory.length} deployment records`);
            }
        } catch (error) {
            logger.errorLog('Failed to load deployment history', error);
            this.deploymentHistory = [];
        }
    }

    saveDeploymentHistory() {
        try {
            const historyPath = path.join(process.cwd(), 'storage', 'deployment_history.json');
            fs.writeFileSync(historyPath, JSON.stringify(this.deploymentHistory, null, 2));
        } catch (error) {
            logger.errorLog('Failed to save deployment history', error);
        }
    }

    async evaluateTestForWinnerSelection(testId) {
        try {
            const testResults = abTestingService.getTestResults(testId);
            if (!testResults) {
                return { canDeploy: false, reason: 'Test not found' };
            }

            // Check if test is completed
            if (testResults.status !== 'completed') {
                return { canDeploy: false, reason: 'Test not completed' };
            }

            const evaluation = this.evaluateTestCriteria(testResults);
            
            logger.systemLog('WINNER_SELECTION', `Test ${testId} evaluation: ${JSON.stringify(evaluation)}`);
            
            return evaluation;
        } catch (error) {
            logger.errorLog('Failed to evaluate test for winner selection', error);
            return { canDeploy: false, reason: 'Evaluation error', error: error.message };
        }
    }

    evaluateTestCriteria(testResults) {
        const significance = testResults.significance;
        
        // Check statistical significance
        if (!significance || !significance.isSignificant) {
            return {
                canDeploy: false,
                reason: 'Not statistically significant',
                pValue: significance?.pValue || 'unknown'
            };
        }

        // Check confidence level (p-value)
        const confidenceLevel = 1 - significance.pValue;
        if (confidenceLevel < this.config.minimumConfidenceLevel) {
            return {
                canDeploy: false,
                reason: 'Confidence level too low',
                confidenceLevel,
                required: this.config.minimumConfidenceLevel
            };
        }

        // Check improvement threshold
        if (significance.improvement < this.config.minimumImprovementThreshold) {
            return {
                canDeploy: false,
                reason: 'Improvement below threshold',
                improvement: significance.improvement,
                required: this.config.minimumImprovementThreshold
            };
        }

        // Check sample size
        if (testResults.totalPredictions < this.config.minimumSampleSize) {
            return {
                canDeploy: false,
                reason: 'Sample size too small',
                sampleSize: testResults.totalPredictions,
                required: this.config.minimumSampleSize
            };
        }

        // Check test duration
        if (testResults.duration < this.config.minimumTestDuration) {
            return {
                canDeploy: false,
                reason: 'Test duration too short',
                duration: testResults.duration,
                required: this.config.minimumTestDuration
            };
        }

        // All criteria met
        return {
            canDeploy: true,
            winner: significance.winner,
            winnerModel: significance.winner === 'A' ? testResults.modelA : testResults.modelB,
            confidence: confidenceLevel,
            improvement: significance.improvement,
            recommendation: 'Ready for deployment'
        };
    }

    async autoDeployWinner(testId) {
        if (!this.config.autoDeployEnabled) {
            return { deployed: false, reason: 'Auto-deployment disabled' };
        }

        try {
            const evaluation = await this.evaluateTestForWinnerSelection(testId);
            
            if (!evaluation.canDeploy) {
                return { deployed: false, ...evaluation };
            }

            const deploymentResult = await this.executeDeployment(testId, evaluation);
            
            // Record deployment
            this.recordDeployment({
                testId,
                evaluation,
                deployment: deploymentResult,
                timestamp: new Date(),
                triggeredBy: 'auto'
            });

            return deploymentResult;
        } catch (error) {
            logger.errorLog('Failed to auto-deploy winner', error);
            return { deployed: false, reason: 'Deployment error', error: error.message };
        }
    }

    async executeDeployment(testId, evaluation) {
        const testResults = abTestingService.getTestResults(testId);
        const winnerModel = evaluation.winnerModel;
        
        logger.systemLog('WINNER_SELECTION', `Deploying winner: ${winnerModel.name} (${winnerModel.version})`);

        try {
            // Create backup of current model before deployment
            const currentVersion = modelVersioning.getVersionsInfo().currentVersion;
            if (currentVersion) {
                await modelVersioning.createBackup(currentVersion, `pre_deployment_${testId}`);
            }

            // Deploy based on strategy
            let deploymentResult;
            switch (this.config.deploymentStrategy) {
                case 'replace':
                    deploymentResult = await this.replaceDeployment(winnerModel);
                    break;
                case 'canary':
                    deploymentResult = await this.canaryDeployment(winnerModel);
                    break;
                case 'blue-green':
                    deploymentResult = await this.blueGreenDeployment(winnerModel);
                    break;
                default:
                    throw new Error(`Unknown deployment strategy: ${this.config.deploymentStrategy}`);
            }

            // Verify deployment success
            const verification = await this.verifyDeployment(winnerModel);
            
            if (!verification.success && this.config.rollbackOnFailure) {
                logger.systemLog('WINNER_SELECTION', 'Deployment verification failed, rolling back');
                await this.rollbackDeployment(currentVersion);
                return {
                    deployed: false,
                    reason: 'Deployment verification failed, rolled back',
                    verification
                };
            }

            logger.systemLog('WINNER_SELECTION', `Successfully deployed ${winnerModel.name} ${winnerModel.version}`);
            
            // Send notification if enabled
            if (this.config.notificationEnabled) {
                this.sendDeploymentNotification(testId, evaluation, deploymentResult);
            }

            return {
                deployed: true,
                model: winnerModel,
                strategy: this.config.deploymentStrategy,
                verification,
                improvement: evaluation.improvement,
                confidence: evaluation.confidence
            };

        } catch (error) {
            logger.errorLog('Deployment execution failed', error);
            
            // Attempt rollback if enabled
            if (this.config.rollbackOnFailure && currentVersion) {
                try {
                    await this.rollbackDeployment(currentVersion);
                    logger.systemLog('WINNER_SELECTION', 'Rolled back after deployment failure');
                } catch (rollbackError) {
                    logger.errorLog('Rollback failed after deployment error', rollbackError);
                }
            }

            return {
                deployed: false,
                reason: 'Deployment execution failed',
                error: error.message
            };
        }
    }

    async replaceDeployment(winnerModel) {
        // Simple replacement deployment
        const newVersion = `v${Date.now()}`;
        
        // In a real implementation, this would:
        // 1. Copy the winning model files to the production location
        // 2. Update model versioning
        // 3. Restart model serving if needed
        
        logger.systemLog('WINNER_SELECTION', `Executing replace deployment for ${winnerModel.name}`);
        
        // Simulate deployment process
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        return {
            strategy: 'replace',
            version: newVersion,
            status: 'completed',
            deployedAt: new Date()
        };
    }

    async canaryDeployment(winnerModel) {
        // Canary deployment - gradual rollout
        logger.systemLog('WINNER_SELECTION', `Executing canary deployment for ${winnerModel.name} (${this.config.canaryPercentage}%)`);
        
        // In a real implementation, this would:
        // 1. Deploy to a subset of traffic
        // 2. Monitor performance
        // 3. Gradually increase traffic if successful
        
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        return {
            strategy: 'canary',
            percentage: this.config.canaryPercentage,
            status: 'canary_active',
            deployedAt: new Date()
        };
    }

    async blueGreenDeployment(winnerModel) {
        // Blue-green deployment - parallel environment
        logger.systemLog('WINNER_SELECTION', `Executing blue-green deployment for ${winnerModel.name}`);
        
        // In a real implementation, this would:
        // 1. Set up parallel environment (green)
        // 2. Deploy to green environment
        // 3. Test green environment
        // 4. Switch traffic from blue to green
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        return {
            strategy: 'blue-green',
            status: 'switched',
            deployedAt: new Date()
        };
    }

    async verifyDeployment(winnerModel) {
        // Verify that the deployment was successful
        logger.systemLog('WINNER_SELECTION', 'Verifying deployment...');
        
        try {
            // In a real implementation, this would:
            // 1. Check that the model loads correctly
            // 2. Run health checks
            // 3. Verify prediction accuracy
            // 4. Check response times
            
            // Simulate verification
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // For now, assume verification passes
            return {
                success: true,
                checks: [
                    { name: 'model_loading', status: 'passed' },
                    { name: 'health_check', status: 'passed' },
                    { name: 'prediction_test', status: 'passed' }
                ],
                verifiedAt: new Date()
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                verifiedAt: new Date()
            };
        }
    }

    async rollbackDeployment(previousVersion) {
        logger.systemLog('WINNER_SELECTION', `Rolling back to version: ${previousVersion}`);
        
        try {
            // In a real implementation, this would:
            // 1. Restore the previous model version
            // 2. Update routing/load balancer
            // 3. Verify rollback success
            
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            return {
                success: true,
                rolledBackTo: previousVersion,
                rolledBackAt: new Date()
            };
        } catch (error) {
            logger.errorLog('Rollback failed', error);
            throw error;
        }
    }

    recordDeployment(deploymentRecord) {
        this.deploymentHistory.push(deploymentRecord);
        this.saveDeploymentHistory();
        
        logger.systemLog('WINNER_SELECTION', 'Deployment recorded in history');
    }

    sendDeploymentNotification(testId, evaluation, deploymentResult) {
        // In a real implementation, this would send notifications via:
        // - Email
        // - Slack
        // - Webhook
        // - Database event
        
        const notification = {
            type: 'deployment',
            testId,
            winnerModel: evaluation.winnerModel,
            improvement: evaluation.improvement,
            confidence: evaluation.confidence,
            deploymentStrategy: this.config.deploymentStrategy,
            timestamp: new Date()
        };
        
        logger.systemLog('WINNER_SELECTION', `Deployment notification: ${JSON.stringify(notification)}`);
    }

    async manualDeployWinner(testId, forceOverride = false) {
        try {
            const evaluation = await this.evaluateTestForWinnerSelection(testId);
            
            if (!evaluation.canDeploy && !forceOverride) {
                return { deployed: false, ...evaluation };
            }

            if (forceOverride && !evaluation.canDeploy) {
                logger.systemLog('WINNER_SELECTION', `Manual deployment with force override for test ${testId}`);
                evaluation.canDeploy = true;
                evaluation.forceOverride = true;
            }

            const deploymentResult = await this.executeDeployment(testId, evaluation);
            
            // Record deployment
            this.recordDeployment({
                testId,
                evaluation,
                deployment: deploymentResult,
                timestamp: new Date(),
                triggeredBy: 'manual'
            });

            return deploymentResult;
        } catch (error) {
            logger.errorLog('Failed to manually deploy winner', error);
            return { deployed: false, reason: 'Manual deployment error', error: error.message };
        }
    }

    getDeploymentHistory() {
        return this.deploymentHistory;
    }

    getDeploymentStats() {
        const total = this.deploymentHistory.length;
        const successful = this.deploymentHistory.filter(d => d.deployment.deployed).length;
        const automatic = this.deploymentHistory.filter(d => d.triggeredBy === 'auto').length;
        const manual = this.deploymentHistory.filter(d => d.triggeredBy === 'manual').length;

        return {
            totalDeployments: total,
            successfulDeployments: successful,
            automaticDeployments: automatic,
            manualDeployments: manual,
            successRate: total > 0 ? (successful / total) * 100 : 0,
            averageImprovement: this.calculateAverageImprovement()
        };
    }

    calculateAverageImprovement() {
        const successfulDeployments = this.deploymentHistory.filter(
            d => d.deployment.deployed && d.evaluation.improvement
        );
        
        if (successfulDeployments.length === 0) return 0;
        
        const totalImprovement = successfulDeployments.reduce(
            (sum, d) => sum + d.evaluation.improvement, 0
        );
        
        return totalImprovement / successfulDeployments.length;
    }

    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        this.saveConfig();
        logger.systemLog('WINNER_SELECTION', 'Configuration updated');
    }

    async simulateCanaryPromotion(testId) {
        // Simulate promoting a canary deployment to full deployment
        logger.systemLog('WINNER_SELECTION', `Promoting canary deployment for test ${testId}`);
        
        // In a real implementation, this would gradually increase traffic
        const promotionSteps = [25, 50, 75, 100];
        
        for (const percentage of promotionSteps) {
            logger.systemLog('WINNER_SELECTION', `Canary traffic: ${percentage}%`);
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Check metrics at each step
            const metrics = await this.checkCanaryMetrics();
            if (!metrics.healthy) {
                logger.systemLog('WINNER_SELECTION', 'Canary metrics unhealthy, stopping promotion');
                return { promoted: false, reason: 'Unhealthy metrics' };
            }
        }
        
        return { promoted: true, finalPercentage: 100 };
    }

    async checkCanaryMetrics() {
        // In a real implementation, this would check actual metrics
        return { healthy: true, errorRate: 0.01, responseTime: 150 };
    }
}

export default new WinnerSelectionService();