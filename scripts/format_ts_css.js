// Script to run prettier for each uncommited file on web/src

const { execSync, spawn } = require('child_process');
const { existsSync } = require('fs');
const { resolve, join } = require('path');
const path = require('path');

const rootDir = resolve(__dirname, '..');
const srcDir = join(rootDir, 'web', 'src');

function getChangedFiles() {
    try {
        const output = execSync('git diff --name-only', { encoding: 'utf-8', cwd: rootDir, stdio: 'pipe' });
        return output
            .split('\n')
            .filter(f => (f.endsWith('.ts') || f.endsWith(".css") || f.endsWith(".vue") || f.endsWith(".json")) && f.trim() !== '')
            .map(f => join(rootDir, f));
    } catch (error) {
        console.error('Failed to get changed files:', error.message);
        return [];
    }
}

async function runPrettier(projDir, file) {
    return new Promise((resolve, reject) => {
        if (!existsSync(projDir)) {
            console.warn(`Project directory does not exist: ${projDir}`);
            resolve();
            return;
        }

        console.log(`Running format for project directory: ${projDir}`);

        const filePath = path.relative(projDir, file);
        console.log("Running format for file: ", filePath);

        const proc = spawn('npx', ['prettier', '--write', filePath], { cwd: projDir, stdio: 'inherit' });

        proc.on('exit', code => {
            if (code === 0) resolve();
            else reject(new Error(`Prettier failed for file ${filePath} in ${projDir}`));
        });
    });
}

async function main() {
    if (!existsSync(srcDir)) {
        console.error(`Source directory does not exist: ${srcDir}`);
        process.exit(1);
    }

    const changedFiles = getChangedFiles();
    if (changedFiles.length === 0) {
        console.log('No changes detected under web');
        return;
    }

    for (const file of changedFiles) {
        const projDir = path.dirname(file);
        await runPrettier(projDir, file);
    }
}

main().catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
});
