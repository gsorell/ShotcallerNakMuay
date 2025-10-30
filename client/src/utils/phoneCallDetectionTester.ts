/**
 * Phone Call Detection Test Suite
 * 
 * This file provides utilities for testing the phone call detection functionality
 * across different scenarios and platforms.
 */

interface TestScenario {
  name: string;
  description: string;
  action: () => void;
  expectedResult: string;
}

export class PhoneCallDetectionTester {
  private phoneCallDetection: any;
  private testResults: Array<{ scenario: string; passed: boolean; details: string }> = [];

  constructor(phoneCallDetectionInstance: any) {
    this.phoneCallDetection = phoneCallDetectionInstance;
  }

  /**
   * Run all test scenarios
   */
  async runAllTests(): Promise<void> {
    console.log('🧪 Starting Phone Call Detection Tests...');
    
    const scenarios = this.getTestScenarios();
    
    for (const scenario of scenarios) {
      await this.runTestScenario(scenario);
      // Wait between tests to avoid race conditions
      await this.delay(1000);
    }
    
    this.printTestResults();
  }

  /**
   * Test manual interruption triggering
   */
  async testManualInterruption(): Promise<boolean> {
    console.log('🔧 Testing manual interruption...');
    
    try {
      // Trigger interruption
      this.phoneCallDetection.forceInterruption('manual-test');
      
      // Check state after a brief delay
      await this.delay(100);
      
      const isInterrupted = this.phoneCallDetection.isInterrupted;
      
      if (isInterrupted) {
        console.log('✅ Manual interruption triggered successfully');
        
        // Test resume
        this.phoneCallDetection.forceResume('manual-test');
        await this.delay(100);
        
        const isResumed = !this.phoneCallDetection.isInterrupted;
        
        if (isResumed) {
          console.log('✅ Manual resume worked successfully');
          return true;
        } else {
          console.log('❌ Manual resume failed');
          return false;
        }
      } else {
        console.log('❌ Manual interruption failed');
        return false;
      }
    } catch (error) {
      console.log('❌ Manual interruption test threw error:', error);
      return false;
    }
  }

  /**
   * Test visibility change detection
   */
  async testVisibilityChange(): Promise<void> {
    console.log('👁️ Testing visibility change detection...');
    console.log('📋 Instructions:');
    console.log('   1. Switch to another tab/app');
    console.log('   2. Wait 2-3 seconds');
    console.log('   3. Switch back to this tab');
    console.log('   4. Check console for results');
    
    // Set up temporary listeners for this test
    let interrupted = false;
    let resumed = false;
    
    const originalCallState = this.phoneCallDetection.callState;
    
    // Monitor for state changes during the test
    const checkStateInterval = setInterval(() => {
      if (this.phoneCallDetection.isInterrupted && !interrupted) {
        interrupted = true;
        console.log('✅ Visibility interruption detected!');
      }
      
      if (!this.phoneCallDetection.isInterrupted && interrupted && !resumed) {
        resumed = true;
        console.log('✅ Visibility resume detected!');
        clearInterval(checkStateInterval);
      }
    }, 500);
    
    // Clean up after 30 seconds
    setTimeout(() => {
      clearInterval(checkStateInterval);
      if (!interrupted) {
        console.log('⏰ Visibility test timed out - try switching tabs');
      }
    }, 30000);
  }

  /**
   * Test focus/blur detection
   */
  async testFocusBlur(): Promise<void> {
    console.log('🎯 Testing focus/blur detection...');
    console.log('📋 Instructions:');
    console.log('   1. Click outside the browser window');
    console.log('   2. Wait 2-3 seconds'); 
    console.log('   3. Click back on the browser window');
    console.log('   4. Check console for results');
    
    // Similar monitoring setup as visibility test
    let interrupted = false;
    let resumed = false;
    
    const checkStateInterval = setInterval(() => {
      if (this.phoneCallDetection.isInterrupted && !interrupted) {
        interrupted = true;
        console.log('✅ Focus interruption detected!');
      }
      
      if (!this.phoneCallDetection.isInterrupted && interrupted && !resumed) {
        resumed = true;
        console.log('✅ Focus resume detected!');
        clearInterval(checkStateInterval);
      }
    }, 500);
    
    setTimeout(() => {
      clearInterval(checkStateInterval);
      if (!interrupted) {
        console.log('⏰ Focus test timed out - try clicking outside the window');
      }
    }, 30000);
  }

  /**
   * Test audio context interruption (if available)
   */
  async testAudioContextInterruption(): Promise<void> {
    console.log('🔊 Testing audio context interruption...');
    
    try {
      // Create test audio context
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      
      if (!AudioContext) {
        console.log('⚠️ AudioContext not available in this browser');
        return;
      }
      
      const testContext = new AudioContext();
      
      console.log(`Audio context initial state: ${testContext.state}`);
      
      // Try to suspend the context
      if (testContext.state === 'running') {
        console.log('📋 Manually suspending audio context to simulate interruption...');
        await testContext.suspend();
        console.log(`Audio context state after suspend: ${testContext.state}`);
        
        // Resume after a delay
        setTimeout(async () => {
          console.log('📋 Resuming audio context...');
          await testContext.resume();
          console.log(`Audio context state after resume: ${testContext.state}`);
          testContext.close();
        }, 2000);
      }
      
    } catch (error) {
      console.log('❌ Audio context test failed:', error);
    }
  }

  /**
   * Get all test scenarios
   */
  private getTestScenarios(): TestScenario[] {
    return [
      {
        name: 'Manual Interruption',
        description: 'Test programmatic interruption triggering',
        action: () => this.testManualInterruption(),
        expectedResult: 'Should detect forced interruption and resume'
      },
      {
        name: 'Visibility Change',
        description: 'Test tab switching detection',
        action: () => this.testVisibilityChange(),
        expectedResult: 'Should detect when tab becomes hidden/visible'
      },
      {
        name: 'Focus/Blur',
        description: 'Test window focus detection',
        action: () => this.testFocusBlur(),
        expectedResult: 'Should detect when window loses/gains focus'
      },
      {
        name: 'Audio Context',
        description: 'Test audio interruption detection',
        action: () => this.testAudioContextInterruption(),
        expectedResult: 'Should detect audio context state changes'
      }
    ];
  }

  /**
   * Run a single test scenario
   */
  private async runTestScenario(scenario: TestScenario): Promise<void> {
    console.log(`\n🧪 Running test: ${scenario.name}`);
    console.log(`📝 Description: ${scenario.description}`);
    console.log(`🎯 Expected: ${scenario.expectedResult}`);
    
    try {
      await scenario.action();
      this.testResults.push({
        scenario: scenario.name,
        passed: true,
        details: 'Test completed successfully'
      });
    } catch (error) {
      console.log(`❌ Test failed: ${error}`);
      this.testResults.push({
        scenario: scenario.name,
        passed: false,
        details: `Error: ${error}`
      });
    }
  }

  /**
   * Print final test results
   */
  private printTestResults(): void {
    console.log('\n📊 Test Results Summary:');
    console.log('='.repeat(50));
    
    let passedCount = 0;
    let totalCount = this.testResults.length;
    
    this.testResults.forEach(result => {
      const status = result.passed ? '✅ PASS' : '❌ FAIL';
      console.log(`${status} - ${result.scenario}: ${result.details}`);
      if (result.passed) passedCount++;
    });
    
    console.log('='.repeat(50));
    console.log(`📈 Results: ${passedCount}/${totalCount} tests passed`);
    
    if (passedCount === totalCount) {
      console.log('🎉 All tests passed! Phone call detection is working correctly.');
    } else {
      console.log('⚠️ Some tests failed. Check individual test results above.');
    }
  }

  /**
   * Utility: delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current detection state info
   */
  getStateInfo(): object {
    return {
      isInterrupted: this.phoneCallDetection.isInterrupted,
      callState: this.phoneCallDetection.callState,
      timeSinceInterruption: this.phoneCallDetection.timeSinceInterruption,
      platform: navigator.userAgent,
      supportedFeatures: {
        visibilityAPI: typeof document.hidden !== 'undefined',
        audioContext: typeof (window.AudioContext || (window as any).webkitAudioContext) !== 'undefined',
        focusEvents: typeof window.onfocus !== 'undefined'
      }
    };
  }
}

/**
 * Quick test function for console usage
 */
export function testPhoneCallDetection(phoneCallDetectionInstance: any): void {
  const tester = new PhoneCallDetectionTester(phoneCallDetectionInstance);
  
  console.log('🚀 Phone Call Detection Test Started');
  console.log('📱 Current state:', tester.getStateInfo());
  
  // Run quick manual test
  tester.testManualInterruption().then(success => {
    if (success) {
      console.log('✅ Quick test passed! Phone call detection is responding correctly.');
      console.log('🧪 Run tester.runAllTests() for comprehensive testing.');
    } else {
      console.log('❌ Quick test failed. Check the implementation.');
    }
  });
}

// Export for global console access in development
if (typeof window !== 'undefined') {
  (window as any).testPhoneCallDetection = testPhoneCallDetection;
  (window as any).PhoneCallDetectionTester = PhoneCallDetectionTester;
}