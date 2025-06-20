import MLModelTestSuite from '../tests/mlModelTests.js';
import logger from '../utils/logger.js';
import fs from 'fs';
import path from 'path';

async function runModelTests() {
    console.log('🔬 Starting ML Model Test Suite...\n');
    
    const testSuite = new MLModelTestSuite();
    
    try {
        const results = await testSuite.runAllTests();
        
        // Display results
        console.log('📊 Test Results Summary:');
        console.log(`✅ Passed: ${results.summary.passed}`);
        console.log(`❌ Failed: ${results.summary.failed}`);
        console.log(`⚠️  Warnings: ${results.summary.warnings}`);
        console.log(`⏭️  Skipped: ${results.summary.skipped}`);
        console.log(`🔥 Errors: ${results.summary.errors}`);
        console.log(`📈 Score: ${results.summary.score.toFixed(1)}%\n`);
        
        // Show detailed results
        console.log('📝 Detailed Test Results:');
        results.results.forEach(result => {
            const statusIcon = {
                'passed': '✅',
                'failed': '❌', 
                'warning': '⚠️',
                'error': '🔥',
                'skipped': '⏭️'
            }[result.status] || '❓';
            
            console.log(`${statusIcon} ${result.testName}: ${result.message || result.status}`);
            
            if (result.metrics) {
                console.log(`   📊 Metrics:`, JSON.stringify(result.metrics, null, 2));
            }
            
            if (result.error) {
                console.log(`   ❗ Error: ${result.error}`);
            }
        });
        
        // Show recommendations
        if (results.recommendations.length > 0) {
            console.log('\n💡 Recommendations:');
            results.recommendations.forEach(rec => {
                const priorityIcon = {
                    'high': '🔴',
                    'medium': '🟡', 
                    'low': '🟢'
                }[rec.priority] || '⚪';
                
                console.log(`${priorityIcon} [${rec.category.toUpperCase()}] ${rec.message}`);
            });
        }
        
        // Save results to file
        const resultsPath = path.join(process.cwd(), 'storage', 'test_results.json');
        const outputData = {
            timestamp: new Date().toISOString(),
            summary: results.summary,
            results: results.results,
            recommendations: results.recommendations
        };
        
        fs.writeFileSync(resultsPath, JSON.stringify(outputData, null, 2));
        console.log(`\n💾 Results saved to: ${resultsPath}`);
        
        // Exit with appropriate code
        const exitCode = results.summary.success ? 0 : 1;
        console.log(`\n${results.summary.success ? '🎉 All tests passed!' : '⚠️ Some tests failed'}`);
        
        return results;
        
    } catch (error) {
        console.error('💥 Test suite failed to run:', error.message);
        logger.errorLog('Test suite execution failed', error);
        return null;
    }
}

// Run tests if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    runModelTests()
        .then(results => {
            if (!results || !results.summary.success) {
                process.exit(1);
            }
        })
        .catch(error => {
            console.error('Fatal error:', error);
            process.exit(1);
        });
}

export default runModelTests;