import { execSync, spawn } from 'child_process'
import { readdirSync, existsSync } from 'fs'
import { dirname, resolve, join, relative } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const rootDir = resolve(__dirname, '..')
const srcDir = join(rootDir, 'server', 'LiventCord')

function getChangedFiles() {
    try {
        const output = execSync('git diff --name-only', { encoding: 'utf-8', cwd: rootDir, stdio: 'pipe' })
        return output
            .split('\n')
            .filter(f => f.endsWith('.cs') && f.trim() !== '')
            .map(f => join(rootDir, f))
    } catch (error) {
        console.error('Failed to get changed files:', (error).message)
        return []
    }
}

async function runFormatGlobally() {
    const proc = spawn('dotnet', ['format'], { cwd: rootDir, stdio: 'inherit' });

    return new Promise((resolve, reject) => {
        proc.on('exit', code => {
            if (code === 0) resolve()
            else reject(new Error('dotnet format failed globally.'));
        })
    });
}

async function runFormatForFiles(changedFiles) {
    const tasks = changedFiles.map(file => {
        return new Promise((resolve, reject) => {
            const filePath = relative(rootDir, file);
            const args = ['format', '--include', filePath];
            const proc = spawn('dotnet', args, { cwd: rootDir, stdio: 'inherit' });

            proc.on('exit', code => {
                if (code === 0) resolve();
                else reject(new Error(`dotnet format failed for ${filePath}`));
            });
        });
    });

    const results = await Promise.allSettled(tasks);

    results.forEach(result => {
        if (result.status === 'rejected') console.error(result.reason);
    });
}

async function main() {
    if (!existsSync(srcDir)) {
        console.error(`Source directory does not exist: ${srcDir}`);
        process.exit(1);
    }

    const changedFiles = getChangedFiles();
    if (changedFiles.length === 0) {
        console.log('No .cs changes detected under server/LiventCord');
        return;
    }

    if (changedFiles.length > 5) {
        console.log("Running csharp format globally...")
        await runFormatGlobally();
    } else {
        console.log("Running csharp for " + changedFiles.length  + " files...")
        await runFormatForFiles(changedFiles);
    }
}

main().catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
});
