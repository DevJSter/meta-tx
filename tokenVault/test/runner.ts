#!/usr/bin/env ts-node

/**
 * Test Runner for TokenVault
 * Runs all tests in the test directory
 */

import { spawn } from 'child_process';
import path from 'path';

const testFiles = [
  'test/test.ts',
  'test/server-test.ts'
];

class TestRunner {
  private passedTests = 0;
  private failedTests = 0;

  async runAllTests() {
    console.log('TokenVault Test Suite Runner\n');
    console.log('━'.repeat(50));
    
    for (const testFile of testFiles) {
      console.log(`\nRunning: ${testFile}`);
      console.log('─'.repeat(30));
      
      try {
        await this.runTest(testFile);
        console.log(`PASS: ${testFile} - PASSED`);
        this.passedTests++;
      } catch (error) {
        console.log(`FAIL: ${testFile} - FAILED`);
        console.error(error);
        this.failedTests++;
      }
    }
    
    console.log('\n' + '━'.repeat(50));
    console.log(`Test Results: ${this.passedTests} passed, ${this.failedTests} failed`);
    
    if (this.failedTests > 0) {
      process.exit(1);
    }
  }

  private async runTest(testFile: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn('npx', ['ts-node', testFile], {
        stdio: 'inherit',
        cwd: process.cwd()
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Test failed with exit code ${code}`));
        }
      });

      child.on('error', (error) => {
        reject(error);
      });
    });
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const runner = new TestRunner();
  runner.runAllTests();
}

export default TestRunner;
