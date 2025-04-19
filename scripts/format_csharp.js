// Script to run dotnet format for each uncommited file on server/src directory

const { execSync, spawn } = require('child_process')
const { readdirSync, existsSync } = require('fs')
const { dirname, resolve,  join } = require('path')
const path = require('path');

const rootDir = resolve(__dirname,"..")
const srcDir = join(rootDir, 'server', 'src')

function getChangedFiles() {
    try {
        const output = execSync('git diff --name-only', { encoding: 'utf-8', cwd: rootDir, stdio: 'pipe' });
        return output
            .split('\n')
            .filter(f => f.endsWith('.cs') && f.trim() !== '')
            .map(f => join(rootDir, f))
    } catch (error) {
        console.error('Failed to get changed files:', error.message)
        return []
    }
}

function findCsprojDir(file) {
    try {
        let dir = resolve(dirname(file))
        while (dir !== '/' && dir.length > rootDir.length) {
            if (!existsSync(dir)) {
                console.warn(`Directory does not exist: ${dir}`)
                return null
            }
            const entries = readdirSync(dir)
            const hasCsproj = entries.some(e => e.endsWith('.csproj'))
            if (hasCsproj) return dir
            const parent = dirname(dir)
            if (parent === dir) break
            dir = parent
        }
        return null
    } catch (error) {
        console.warn(`Failed to find .csproj directory for ${file}:`, error.message)
        return null
    }
}

function groupFilesByProject(files) {
    const groups = {}
    for (const file of files) {
        const projDir = findCsprojDir(file)
        if (projDir) {
            if (!groups[projDir]) groups[projDir] = []
            groups[projDir].push(file)
        }
    }
    return groups
}

async function runFormatForProjects(projectGroups) {
    const promises = Object.entries(projectGroups).map(([projDir, files]) => {
        return new Promise((resolve, reject) => {
            if (!existsSync(projDir)) {
                console.warn(`Project directory does not exist: ${projDir}`)
                resolve()
                return
            }
            
            console.log(`Running format for project directory: ${projDir}`)

            const filePromises = files.map(file => {
                const filePath = path.relative(projDir, file);
                console.log("Running format for file: ", filePath)

                return new Promise((fileResolve, fileReject) => {
                    const args = ['format', '--include', filePath];
                    const proc = spawn('dotnet', args, { cwd: projDir, stdio: 'inherit' });

                    proc.on('exit', code => {
                        if (code === 0) fileResolve();
                        else fileReject(new Error(`dotnet format failed for file ${filePath} in ${projDir}`));
                    });
                });
            });

            Promise.all(filePromises)
                .then(() => resolve())
                .catch((error) => reject(error));
        });
    });

    await Promise.all(promises);
}
async function main() {
    if (!existsSync(srcDir)) {
        console.error(`Source directory does not exist: ${srcDir}`)
        process.exit(1)
    }

    const changedFiles = getChangedFiles()
    if (changedFiles.length === 0) {
        console.log('No .cs changes detected under server/src')
        return
    }

    const projectGroups = groupFilesByProject(changedFiles)
    if (Object.keys(projectGroups).length === 0) {
        console.log('No matching projects found for changed files.')
        return
    }

    await runFormatForProjects(projectGroups)
}

main().catch(err => {
    console.error('Error:', err.message)
    process.exit(1)
})