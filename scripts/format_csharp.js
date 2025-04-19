// Script to run dotnet format for each uncommited file on server/src directory

import { execSync, spawn } from 'child_process'
import { readdirSync, existsSync } from 'fs'
import { dirname, resolve, join, relative } from 'path'

const rootDir = resolve(__dirname, '..')
const srcDir = join(rootDir, 'server', 'src')

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

function findCsprojDir(file) {
    try {
        let dir = resolve(dirname(file))
        while (dir !== '/' && dir.length > rootDir.length) {
            if (!existsSync(dir)) return null
            const entries = readdirSync(dir)
            if (entries.some(e => e.endsWith('.csproj'))) return dir
            const parent = dirname(dir)
            if (parent === dir) break
            dir = parent
        }
        return null
    } catch (error) {
        console.warn(`Failed to find .csproj directory for ${file}:`, (error).message)
        return null
    }
}

function groupFilesByProject(files) {
    const groups= {}
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
    const tasks = Object.entries(projectGroups).flatMap(([projDir, files]) => {
        if (!existsSync(projDir)) return []

        return files.map(file => {
            return new Promise((resolve, reject) => {
                const filePath = relative(projDir, file)
                const args = ['format', '--include', filePath]
                const proc = spawn('dotnet', args, { cwd: projDir, stdio: 'inherit' })

                proc.on('exit', code => {
                    if (code === 0) resolve()
                    else reject(new Error(`dotnet format failed for ${filePath} in ${projDir}`))
                })
            })
        })
    })

    const results = await Promise.allSettled(tasks)

    results.forEach(result => {
        if (result.status === 'rejected') console.error(result.reason)
    })
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
