import { execSync, spawn } from 'child_process'
import { existsSync } from 'fs'
import { resolve, join, relative, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const rootDir = resolve(__dirname, '..')
const srcDir = join(rootDir, 'web', 'src')

function getChangedFiles() {
    try {
        const output = execSync('git diff --name-only', { encoding: 'utf-8', cwd: rootDir, stdio: 'pipe' })
        return output
            .split('\n')
            .filter(f => (f.endsWith('.ts') || f.endsWith('.css') || f.endsWith('.vue') || f.endsWith('.json')) && f.trim() !== '')
            .map(f => join(rootDir, f))
    } catch (error) {
        console.error('Failed to get changed files:', error.message)
        return []
    }
}

function runPrettier(projDir, file) {
    return new Promise((resolve, reject) => {
        if (!existsSync(projDir)) {
            console.warn(`Project directory does not exist: ${projDir}`)
            resolve()
            return
        }

        console.log(`Running format for project directory: ${projDir}`)

        const filePath = relative(projDir, file)
        console.log('Running format for file: ', filePath)

        const isWin = process.platform === 'win32'
        const proc = spawn(isWin ? 'npx.cmd' : 'npx', ['prettier', '--write', filePath], {
        cwd: projDir,
        stdio: 'inherit',
        shell: true,
        env: process.env
        })

        proc.on('exit', code => {
            if (code === 0) resolve()
            else reject(new Error(`Prettier failed for file ${filePath} in ${projDir}`))
        })
    })
}

async function main() {
    if (!existsSync(srcDir)) {
        console.error(`Source directory does not exist: ${srcDir}`)
        process.exit(1)
    }

    const changedFiles = getChangedFiles()
    if (changedFiles.length === 0) {
        console.log('No changes detected under web')
        return
    }

    await Promise.all(
        changedFiles.map(file => {
            const projDir = dirname(file)
            return runPrettier(projDir, file)
        })
    )
}

main().catch(err => {
    console.error('Error:', err.message)
    process.exit(1)
})
