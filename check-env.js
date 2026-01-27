#!/usr/bin/env node

/**
 * Pre-flight check script
 * Verifies all required services are running before starting the server
 */

const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const checks = {
  node: {
    name: 'Node.js',
    command: 'node --version',
    required: true,
  },
  postgres: {
    name: 'PostgreSQL',
    command: 'psql --version',
    required: true,
    tip: 'Install PostgreSQL from https://www.postgresql.org/download/',
  },
  redis: {
    name: 'Redis',
    command: 'redis-cli --version',
    required: true,
    tip: 'Install Redis from https://redis.io/download or use WSL on Windows',
  },
};

async function runCheck(check) {
  try {
    const { stdout } = await execPromise(check.command);
    return { success: true, version: stdout.trim() };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function checkEnvironment() {
  console.log('🔍 Checking prerequisites...\n');

  let allPassed = true;

  for (const [key, check] of Object.entries(checks)) {
    process.stdout.write(`${check.name}... `);
    const result = await runCheck(check);

    if (result.success) {
      console.log(`✅ ${result.version || 'OK'}`);
    } else {
      console.log(`❌ NOT FOUND`);
      if (check.tip) {
        console.log(`   Tip: ${check.tip}`);
      }
      if (check.required) {
        allPassed = false;
      }
    }
  }

  console.log();

  // Check .env file
  const fs = require('fs');
  const path = require('path');
  const envPath = path.join(__dirname, '.env');

  if (!fs.existsSync(envPath)) {
    console.log('❌ .env file not found');
    console.log('   Tip: Copy .env.example to .env and configure it');
    allPassed = false;
  } else {
    console.log('✅ .env file exists');
  }

  console.log();

  if (!allPassed) {
    console.log('❌ Some prerequisites are missing. Please fix them before starting the server.\n');
    console.log('📖 Check QUICKSTART.md for setup instructions');
    process.exit(1);
  } else {
    console.log('✅ All prerequisites met! Starting server...\n');
  }
}

checkEnvironment().catch((error) => {
  console.error('Error during pre-flight check:', error);
  process.exit(1);
});
