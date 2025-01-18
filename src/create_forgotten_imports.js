const fs = require('fs');
const path = require('path');

const defaultIdentifiers = [
  'window',
  'document',
  'console',
  'Math',
  'Object',
  'Array',
  'Date',
  'RegExp',
  'Function',
  'String',
  'Number',
  'Boolean',
  'Symbol',
  'Error',
  'JSON',
  'Promise',
  'Set',
  'Map',
  'WeakSet',
  'WeakMap',
  'Intl',
  'Buffer',
  'globalThis',
];

function extractFunctionsAndVariables(fileContent) {
  const functionRegex =
    /(?:function\s+(\w+)\s?\(|(?:const|let|var)\s+(\w+)\s?=\s?(?:function\s?\(|\(\)\s?=>\s?))/g;
  const variableRegex = /(?:const|let|var)\s+(\w+)\s?=/g;
  const functionsAndVariables = [];
  let match;

  while ((match = functionRegex.exec(fileContent)) !== null) {
    const funcName = match[1] || match[2];
    if (funcName.length >= 5 && !defaultIdentifiers.includes(funcName)) {
      functionsAndVariables.push(funcName);
    }
  }

  while ((match = variableRegex.exec(fileContent)) !== null) {
    const varName = match[1];
    if (varName.length >= 5 && !defaultIdentifiers.includes(varName)) {
      functionsAndVariables.push(varName);
    }
  }

  return functionsAndVariables;
}

function extractReferences(fileContent) {
  const referenceRegex = /\b(\w+)\b/g;
  const references = [];
  let match;

  while ((match = referenceRegex.exec(fileContent)) !== null) {
    references.push(match[1]);
  }

  return references;
}

function isReferenceInsideObject(ref) {
  return ref.includes('.');
}

function isDeclaredInsideFunction(fileContent, name) {
  const functionDeclarationRegex = new RegExp(
    `function\\s+\\w+\\s?\\(.*\\)\\s?{[^}]*?${name}[^}]*}`,
    'g',
  );
  const variableDeclarationRegex = new RegExp(
    `(?:let|const|var)\\s+${name}\\s?=.*{[^}]*}`,
    'g',
  );

  return (
    functionDeclarationRegex.test(fileContent) ||
    variableDeclarationRegex.test(fileContent)
  );
}

function scanDirectory(directory) {
  const files = fs.readdirSync(directory);
  const fileExports = {};

  files.forEach((file) => {
    if (file.endsWith('.js')) {
      const filePath = path.join(directory, file);
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const functionsAndVariables = extractFunctionsAndVariables(fileContent);
      if (functionsAndVariables.length > 0) {
        fileExports[file] = functionsAndVariables;
      }
    }
  });

  return fileExports;
}

function isImported(fileContent, refName) {
  const importRegex = new RegExp(`import.*{[^}]*\\b${refName}\\b[^}]*}`, 'g');
  return importRegex.test(fileContent);
}

function getExportingFile(fileExports, refName) {
  for (let [file, exports] of Object.entries(fileExports)) {
    if (exports.includes(refName)) {
      return file.replace('.js', '');
    }
  }
  return null;
}

function prependImportsToFile(fileContent, missingImports) {
  const importStatements = Object.entries(missingImports)
    .map(
      ([importedFile, functions]) =>
        `import { ${functions.join(', ')} } from './${importedFile}';`,
    )
    .join('\n');

  if (importStatements) {
    fileContent = importStatements + '\n' + fileContent;
  }

  return fileContent;
}

function modifyFunctionsToExport(fileContent, usedReferences, file) {
  const functionRegex =
    /(?:async\s+)?function\s+(\w+)\s?\(([^)]*)\)\s?{|\s*(?:const|let|var)\s+(\w+)\s?=\s?(?:async\s+)?function\s?\(([^)]*)\)\s?{/g;

  const updatedContent = fileContent.replace(
    functionRegex,
    (match, funcName, params, varName, varParams) => {
      // If the function is already exported or if it is not used outside the file, don't change it
      if (
        match.trim().startsWith('export') ||
        !usedReferences.includes(funcName) ||
        usedReferences.filter((ref) => ref !== funcName).includes(funcName)
      ) {
        return match;
      }

      if (funcName) {
        // Handling function declarations (async function foo() { ... })
        return `export ${match.trim()}`;
      } else if (varName) {
        // Handling function expressions (const foo = async function() { ... })
        return `export ${match.trim()}`;
      }

      return match;
    },
  );

  return updatedContent;
}

function processFiles(directory) {
  const files = fs.readdirSync(directory);
  const fileExports = scanDirectory(directory);
  let forgottenExports = {};

  let processedImports = new Set();
  let processedExports = new Set();

  files.forEach((file) => {
    if (file.endsWith('.js')) {
      const filePath = path.join(directory, file);
      let fileContent = fs.readFileSync(filePath, 'utf-8');
      const usedReferences = extractReferences(fileContent);
      const missingImports = {};

      usedReferences.forEach((ref) => {
        if (
          !isReferenceInsideObject(ref) &&
          !isImported(fileContent, ref) &&
          !isDeclaredInsideFunction(fileContent, ref)
        ) {
          const exportingFile = getExportingFile(fileExports, ref);
          if (exportingFile && exportingFile !== file.replace('.js', '')) {
            if (!missingImports[exportingFile]) {
              missingImports[exportingFile] = [];
            }
            if (!missingImports[exportingFile].includes(ref)) {
              missingImports[exportingFile].push(ref);
            }
          }
        }
      });

      if (Object.keys(missingImports).length > 0) {
        fileContent = prependImportsToFile(fileContent, missingImports);
      }

      // Modify functions to include the export keyword based on usage
      fileContent = modifyFunctionsToExport(fileContent, usedReferences, file);

      const functionsAndVariables = fileExports[file];
      const newExports = functionsAndVariables.filter(
        (name) => !processedExports.has(name),
      );
      if (newExports.length > 0) {
        newExports.forEach((name) => processedExports.add(name));
        fs.writeFileSync(filePath, fileContent, 'utf-8');
        console.log(`Updated exports for ${file}`);
      }

      if (Object.keys(missingImports).length > 0) {
        forgottenExports[file] = missingImports;
      }
    }
  });

  Object.entries(forgottenExports).forEach(([file, missingData]) => {
    const filePath = path.join(directory, file);
    let fileContent = fs.readFileSync(filePath, 'utf-8');
    fileContent = prependImportsToFile(fileContent, missingData);
    fs.writeFileSync(filePath, fileContent, 'utf-8');
    console.log(`Updated imports for ${file}`);
  });
}

processFiles('./assets/js');
