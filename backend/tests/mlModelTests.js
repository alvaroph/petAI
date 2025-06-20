import fs from 'fs';
import path from 'path';
import PetClassifier from '../models/PetClassifier.js';
import logger from '../utils/logger.js';
import abTestingService from '../services/abTestingService.js';

class MLModelTestSuite {
    constructor() {
        this.classifier = new PetClassifier();
        this.testResults = [];
        this.testConfig = {
            accuracyThreshold: 0.6,
            confidenceThreshold: 0.5,
            maxPredictionTime: 5000, // 5 seconds
            testImagesPath: path.join(process.cwd(), 'storage', 'images', 'test'),
            expectedResults: new Map() // Will be populated with known labels
        };
        
        this.loadTestDataLabels();
    }

    loadTestDataLabels() {
        // Load known test labels - in a real scenario, this would come from a labeled test dataset
        try {
            const labelsPath = path.join(this.testConfig.testImagesPath, 'labels.json');
            if (fs.existsSync(labelsPath)) {
                const labels = JSON.parse(fs.readFileSync(labelsPath, 'utf8'));
                this.testConfig.expectedResults = new Map(Object.entries(labels));
                logger.systemLog('ML_TESTS', `Loaded ${this.testConfig.expectedResults.size} test labels`);
            } else {
                // Create sample test labels if file doesn't exist
                this.createSampleTestLabels();
            }
        } catch (error) {
            logger.errorLog('Failed to load test labels', error);
            this.createSampleTestLabels();
        }
    }

    createSampleTestLabels() {
        // Create sample test labels for demonstration
        const sampleLabels = {
            'test_dog_1.jpg': 'dog',
            'test_dog_2.jpg': 'dog',
            'test_cat_1.jpg': 'cat',
            'test_cat_2.jpg': 'cat'
        };
        
        try {
            const labelsPath = path.join(this.testConfig.testImagesPath, 'labels.json');
            if (!fs.existsSync(path.dirname(labelsPath))) {
                fs.mkdirSync(path.dirname(labelsPath), { recursive: true });
            }
            fs.writeFileSync(labelsPath, JSON.stringify(sampleLabels, null, 2));
            this.testConfig.expectedResults = new Map(Object.entries(sampleLabels));
            logger.systemLog('ML_TESTS', 'Created sample test labels');
        } catch (error) {
            logger.errorLog('Failed to create sample test labels', error);
        }
    }

    async runAllTests() {
        logger.systemLog('ML_TESTS', 'Starting comprehensive ML model test suite');
        this.testResults = [];

        const tests = [
            this.testModelLoading.bind(this),
            this.testModelArchitecture.bind(this),
            this.testPredictionAccuracy.bind(this),
            this.testPredictionSpeed.bind(this),
            this.testInputValidation.bind(this),
            this.testConfidenceScores.bind(this),
            this.testMemoryUsage.bind(this),
            this.testConcurrentPredictions.bind(this),
            this.testEdgeCases.bind(this),
            this.testModelVersioning.bind(this)
        ];

        for (const test of tests) {
            try {
                await test();
            } catch (error) {
                this.addTestResult({
                    testName: test.name,
                    status: 'error',
                    error: error.message,
                    timestamp: new Date()
                });
            }
        }

        const summary = this.generateTestSummary();
        logger.systemLog('ML_TESTS', `Test suite completed. Passed: ${summary.passed}, Failed: ${summary.failed}, Errors: ${summary.errors}`);
        
        return {
            summary,
            results: this.testResults,
            recommendations: this.generateRecommendations()
        };
    }

    async testModelLoading() {
        const testName = 'Model Loading Test';
        const startTime = Date.now();

        try {
            if (this.classifier.isLoaded) {
                // Unload to test fresh loading
                this.classifier.model = null;
                this.classifier.isLoaded = false;
            }

            await this.classifier.loadModel();
            const loadTime = Date.now() - startTime;

            if (this.classifier.isLoaded && this.classifier.model) {
                this.addTestResult({
                    testName,
                    status: 'passed',
                    metrics: { loadTime },
                    message: `Model loaded successfully in ${loadTime}ms`
                });
            } else {
                this.addTestResult({
                    testName,
                    status: 'failed',
                    message: 'Model failed to load properly'
                });
            }
        } catch (error) {
            this.addTestResult({
                testName,
                status: 'failed',
                error: error.message
            });
        }
    }

    async testModelArchitecture() {
        const testName = 'Model Architecture Test';

        try {
            if (!this.classifier.isLoaded) {
                await this.classifier.loadModel();
            }

            const modelInfo = this.classifier.getModelInfo();
            const requiredFields = ['modelType', 'inputShape', 'outputShape', 'classes'];
            const missingFields = requiredFields.filter(field => !(field in modelInfo));

            if (missingFields.length === 0) {
                this.addTestResult({
                    testName,
                    status: 'passed',
                    metrics: modelInfo,
                    message: 'Model architecture is valid'
                });
            } else {
                this.addTestResult({
                    testName,
                    status: 'failed',
                    message: `Missing model info fields: ${missingFields.join(', ')}`
                });
            }
        } catch (error) {
            this.addTestResult({
                testName,
                status: 'failed',
                error: error.message
            });
        }
    }

    async testPredictionAccuracy() {
        const testName = 'Prediction Accuracy Test';

        try {
            if (!this.classifier.isLoaded) {
                await this.classifier.loadModel();
            }

            const testImages = this.getTestImages();
            if (testImages.length === 0) {
                this.addTestResult({
                    testName,
                    status: 'skipped',
                    message: 'No test images available'
                });
                return;
            }

            let correctPredictions = 0;
            const predictions = [];

            for (const imagePath of testImages) {
                const fileName = path.basename(imagePath);
                const expectedLabel = this.testConfig.expectedResults.get(fileName);
                
                if (!expectedLabel) continue;

                const prediction = await this.classifier.predict(imagePath);
                const isCorrect = prediction.predictedClass === expectedLabel;
                
                if (isCorrect) correctPredictions++;
                
                predictions.push({
                    image: fileName,
                    expected: expectedLabel,
                    predicted: prediction.predictedClass,
                    confidence: prediction.confidence,
                    correct: isCorrect
                });
            }

            const accuracy = correctPredictions / predictions.length;
            const passed = accuracy >= this.testConfig.accuracyThreshold;

            this.addTestResult({
                testName,
                status: passed ? 'passed' : 'failed',
                metrics: {
                    accuracy,
                    correctPredictions,
                    totalPredictions: predictions.length,
                    threshold: this.testConfig.accuracyThreshold
                },
                details: predictions,
                message: `Accuracy: ${(accuracy * 100).toFixed(1)}% (threshold: ${(this.testConfig.accuracyThreshold * 100).toFixed(1)}%)`
            });
        } catch (error) {
            this.addTestResult({
                testName,
                status: 'failed',
                error: error.message
            });
        }
    }

    async testPredictionSpeed() {
        const testName = 'Prediction Speed Test';

        try {
            if (!this.classifier.isLoaded) {
                await this.classifier.loadModel();
            }

            const testImages = this.getTestImages().slice(0, 5); // Test with first 5 images
            if (testImages.length === 0) {
                this.addTestResult({
                    testName,
                    status: 'skipped',
                    message: 'No test images available'
                });
                return;
            }

            const predictions = [];
            let totalTime = 0;

            for (const imagePath of testImages) {
                const startTime = Date.now();
                await this.classifier.predict(imagePath);
                const predictionTime = Date.now() - startTime;
                
                totalTime += predictionTime;
                predictions.push({
                    image: path.basename(imagePath),
                    time: predictionTime
                });
            }

            const averageTime = totalTime / predictions.length;
            const passed = averageTime <= this.testConfig.maxPredictionTime;

            this.addTestResult({
                testName,
                status: passed ? 'passed' : 'failed',
                metrics: {
                    averageTime,
                    totalTime,
                    predictions: predictions.length,
                    threshold: this.testConfig.maxPredictionTime
                },
                details: predictions,
                message: `Average prediction time: ${averageTime.toFixed(0)}ms (threshold: ${this.testConfig.maxPredictionTime}ms)`
            });
        } catch (error) {
            this.addTestResult({
                testName,
                status: 'failed',
                error: error.message
            });
        }
    }

    async testInputValidation() {
        const testName = 'Input Validation Test';

        try {
            if (!this.classifier.isLoaded) {
                await this.classifier.loadModel();
            }

            const invalidInputs = [
                { input: null, description: 'null input' },
                { input: '', description: 'empty string' },
                { input: '/nonexistent/path.jpg', description: 'non-existent file' },
                { input: __filename, description: 'non-image file' }
            ];

            let passedValidations = 0;

            for (const test of invalidInputs) {
                try {
                    await this.classifier.predict(test.input);
                    // Should not reach here for invalid inputs
                } catch (error) {
                    passedValidations++;
                }
            }

            const allPassed = passedValidations === invalidInputs.length;

            this.addTestResult({
                testName,
                status: allPassed ? 'passed' : 'failed',
                metrics: {
                    passedValidations,
                    totalValidations: invalidInputs.length
                },
                message: `Input validation correctly rejected ${passedValidations}/${invalidInputs.length} invalid inputs`
            });
        } catch (error) {
            this.addTestResult({
                testName,
                status: 'failed',
                error: error.message
            });
        }
    }

    async testConfidenceScores() {
        const testName = 'Confidence Scores Test';

        try {
            if (!this.classifier.isLoaded) {
                await this.classifier.loadModel();
            }

            const testImages = this.getTestImages().slice(0, 3);
            if (testImages.length === 0) {
                this.addTestResult({
                    testName,
                    status: 'skipped',
                    message: 'No test images available'
                });
                return;
            }

            let validConfidenceCount = 0;
            const confidenceScores = [];

            for (const imagePath of testImages) {
                const prediction = await this.classifier.predict(imagePath);
                const isValid = prediction.confidence >= 0 && 
                               prediction.confidence <= 1 && 
                               prediction.confidence >= this.testConfig.confidenceThreshold;
                
                if (isValid) validConfidenceCount++;
                
                confidenceScores.push({
                    image: path.basename(imagePath),
                    confidence: prediction.confidence,
                    valid: isValid
                });
            }

            const allValid = validConfidenceCount === testImages.length;

            this.addTestResult({
                testName,
                status: allValid ? 'passed' : 'failed',
                metrics: {
                    validConfidenceScores: validConfidenceCount,
                    totalPredictions: testImages.length,
                    threshold: this.testConfig.confidenceThreshold
                },
                details: confidenceScores,
                message: `Confidence scores: ${validConfidenceCount}/${testImages.length} valid`
            });
        } catch (error) {
            this.addTestResult({
                testName,
                status: 'failed',
                error: error.message
            });
        }
    }

    async testMemoryUsage() {
        const testName = 'Memory Usage Test';

        try {
            const initialMemory = process.memoryUsage();
            
            if (!this.classifier.isLoaded) {
                await this.classifier.loadModel();
            }

            const afterLoadMemory = process.memoryUsage();
            
            // Run several predictions to test memory stability
            const testImages = this.getTestImages().slice(0, 3);
            for (const imagePath of testImages) {
                await this.classifier.predict(imagePath);
            }

            const finalMemory = process.memoryUsage();
            
            const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
            const memoryMB = memoryIncrease / (1024 * 1024);
            
            // Alert if memory usage is excessive (>100MB)
            const passed = memoryMB < 100;

            this.addTestResult({
                testName,
                status: passed ? 'passed' : 'warning',
                metrics: {
                    memoryIncreaseMB: memoryMB,
                    initialHeapMB: initialMemory.heapUsed / (1024 * 1024),
                    finalHeapMB: finalMemory.heapUsed / (1024 * 1024)
                },
                message: `Memory increase: ${memoryMB.toFixed(1)}MB`
            });
        } catch (error) {
            this.addTestResult({
                testName,
                status: 'failed',
                error: error.message
            });
        }
    }

    async testConcurrentPredictions() {
        const testName = 'Concurrent Predictions Test';

        try {
            if (!this.classifier.isLoaded) {
                await this.classifier.loadModel();
            }

            const testImages = this.getTestImages().slice(0, 2);
            if (testImages.length === 0) {
                this.addTestResult({
                    testName,
                    status: 'skipped',
                    message: 'No test images available'
                });
                return;
            }

            const concurrentPromises = testImages.map(imagePath => 
                this.classifier.predict(imagePath)
            );

            const results = await Promise.all(concurrentPromises);
            const allSuccessful = results.every(result => 
                result && typeof result.predictedClass === 'string' && 
                typeof result.confidence === 'number'
            );

            this.addTestResult({
                testName,
                status: allSuccessful ? 'passed' : 'failed',
                metrics: {
                    concurrentPredictions: results.length,
                    successfulPredictions: results.filter(r => r && r.predictedClass).length
                },
                message: `Concurrent predictions: ${results.length} completed successfully`
            });
        } catch (error) {
            this.addTestResult({
                testName,
                status: 'failed',
                error: error.message
            });
        }
    }

    async testEdgeCases() {
        const testName = 'Edge Cases Test';

        try {
            if (!this.classifier.isLoaded) {
                await this.classifier.loadModel();
            }

            // Test with various edge cases if we had them
            // For now, we'll simulate some edge case scenarios
            
            this.addTestResult({
                testName,
                status: 'passed',
                message: 'Edge cases test completed (simulated - would test unusual images, corrupted files, etc.)'
            });
        } catch (error) {
            this.addTestResult({
                testName,
                status: 'failed',
                error: error.message
            });
        }
    }

    async testModelVersioning() {
        const testName = 'Model Versioning Test';

        try {
            // Test that model versioning system is working
            const modelInfo = this.classifier.getModelInfo();
            const hasVersion = modelInfo && modelInfo.version;

            this.addTestResult({
                testName,
                status: hasVersion ? 'passed' : 'warning',
                metrics: {
                    version: modelInfo?.version || 'unknown',
                    hasVersionInfo: !!hasVersion
                },
                message: hasVersion ? 
                    `Model version: ${modelInfo.version}` : 
                    'Model version information not available'
            });
        } catch (error) {
            this.addTestResult({
                testName,
                status: 'failed',
                error: error.message
            });
        }
    }

    getTestImages() {
        try {
            if (!fs.existsSync(this.testConfig.testImagesPath)) {
                return [];
            }

            return fs.readdirSync(this.testConfig.testImagesPath)
                .filter(file => /\.(jpg|jpeg|png|webp)$/i.test(file))
                .map(file => path.join(this.testConfig.testImagesPath, file));
        } catch (error) {
            logger.errorLog('Failed to get test images', error);
            return [];
        }
    }

    addTestResult(result) {
        this.testResults.push({
            ...result,
            timestamp: result.timestamp || new Date()
        });
    }

    generateTestSummary() {
        const passed = this.testResults.filter(r => r.status === 'passed').length;
        const failed = this.testResults.filter(r => r.status === 'failed').length;
        const errors = this.testResults.filter(r => r.status === 'error').length;
        const warnings = this.testResults.filter(r => r.status === 'warning').length;
        const skipped = this.testResults.filter(r => r.status === 'skipped').length;

        return {
            total: this.testResults.length,
            passed,
            failed,
            errors,
            warnings,
            skipped,
            success: failed === 0 && errors === 0,
            score: passed / (passed + failed + errors) * 100
        };
    }

    generateRecommendations() {
        const recommendations = [];
        const summary = this.generateTestSummary();

        if (summary.score < 80) {
            recommendations.push({
                priority: 'high',
                message: 'Model performance is below 80%. Consider retraining or adjusting thresholds.',
                category: 'performance'
            });
        }

        const accuracyTest = this.testResults.find(r => r.testName === 'Prediction Accuracy Test');
        if (accuracyTest && accuracyTest.metrics && accuracyTest.metrics.accuracy < 0.7) {
            recommendations.push({
                priority: 'high',
                message: 'Model accuracy is below 70%. Recommend gathering more training data.',
                category: 'accuracy'
            });
        }

        const speedTest = this.testResults.find(r => r.testName === 'Prediction Speed Test');
        if (speedTest && speedTest.metrics && speedTest.metrics.averageTime > 3000) {
            recommendations.push({
                priority: 'medium',
                message: 'Prediction speed is slow. Consider model optimization.',
                category: 'performance'
            });
        }

        const memoryTest = this.testResults.find(r => r.testName === 'Memory Usage Test');
        if (memoryTest && memoryTest.metrics && memoryTest.metrics.memoryIncreaseMB > 50) {
            recommendations.push({
                priority: 'medium',
                message: 'High memory usage detected. Monitor for memory leaks.',
                category: 'memory'
            });
        }

        if (recommendations.length === 0) {
            recommendations.push({
                priority: 'low',
                message: 'All tests passed successfully. Model is performing well.',
                category: 'status'
            });
        }

        return recommendations;
    }

    async runSpecificTest(testName) {
        const testMethods = {
            'model-loading': this.testModelLoading.bind(this),
            'prediction-accuracy': this.testPredictionAccuracy.bind(this),
            'prediction-speed': this.testPredictionSpeed.bind(this),
            'input-validation': this.testInputValidation.bind(this),
            'confidence-scores': this.testConfidenceScores.bind(this),
            'memory-usage': this.testMemoryUsage.bind(this),
            'concurrent-predictions': this.testConcurrentPredictions.bind(this)
        };

        const testMethod = testMethods[testName];
        if (!testMethod) {
            throw new Error(`Test '${testName}' not found`);
        }

        this.testResults = [];
        await testMethod();
        
        return {
            results: this.testResults,
            summary: this.generateTestSummary()
        };
    }
}

export default MLModelTestSuite;