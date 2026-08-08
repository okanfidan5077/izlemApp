const fs = require('fs');
const path = require('path');
const glob = require('glob');
const crypto = require('crypto');

function hashString(str) {
    return crypto.createHash('md5').update(str).digest('hex').substr(0, 6);
}

function processDirectory(srcDir) {
    const htmlFiles = glob.sync('**/*.component.html', { cwd: srcDir, absolute: true });
    
    htmlFiles.forEach(htmlPath => {
        let content = fs.readFileSync(htmlPath, 'utf8');
        let scssContent = '';
        let hasChanges = false;
        
        // 1. Extract <style>...</style> content and remove it
        const styleTagRegex = /<style>([\s\S]*?)<\/style>/g;
        let match;
        while ((match = styleTagRegex.exec(content)) !== null) {
            scssContent += `\n/* Extracted from <style> */\n${match[1]}\n`;
            hasChanges = true;
        }
        content = content.replace(styleTagRegex, '');
        
        // 2. Extract inline style="..." and replace with generated class
        // Handle template bindings like [style.color]="..." ? We should keep those!
        // We only replace literal style="..."
        
        const inlineStyleRegex = /style="([^"]+)"/g;
        let classMappings = new Map();
        
        content = content.replace(inlineStyleRegex, (match, styleString) => {
            if (!styleString.trim()) return '';
            
            // Normalize style string to generate stable hash
            const normStyle = styleString.trim().replace(/\s+/g, ' ');
            let className = '';
            
            if (classMappings.has(normStyle)) {
                className = classMappings.get(normStyle);
            } else {
                className = `st-${hashString(normStyle)}`;
                classMappings.set(normStyle, className);
                scssContent += `\n.${className} {\n  ${styleString.split(';').map(s => s.trim()).filter(Boolean).join(';\n  ')};\n}\n`;
            }
            
            hasChanges = true;
            return `data-temp-class="${className}"`;
        });
        
        // Now merge physical classes
        // If element has class="foo" data-temp-class="bar", make it class="foo bar"
        content = content.replace(/class="([^"]*)"\s+data-temp-class="([^"]+)"/g, 'class="$1 $2"');
        // For elements without class yet, rename temp class
        content = content.replace(/data-temp-class="([^"]+)"/g, 'class="$1"');

        // Also handles single quotes
        const inlineStyleRegexSQ = /style='([^']+)'/g;
        content = content.replace(inlineStyleRegexSQ, (match, styleString) => {
            if (!styleString.trim()) return '';
            const normStyle = styleString.trim().replace(/\s+/g, ' ');
            let className = '';
            if (classMappings.has(normStyle)) {
                className = classMappings.get(normStyle);
            } else {
                className = `st-${hashString(normStyle)}`;
                classMappings.set(normStyle, className);
                scssContent += `\n.${className} {\n  ${styleString.split(';').map(s => s.trim()).filter(Boolean).join(';\n  ')};\n}\n`;
            }
            hasChanges = true;
            return `data-temp-class-sq="${className}"`;
        });
        
        content = content.replace(/class="([^"]*)"\s+data-temp-class-sq="([^"]+)"/g, 'class="$1 $2"');
        content = content.replace(/data-temp-class-sq="([^"]+)"/g, 'class="$1"');
        content = content.replace(/class='([^']*)'\s+data-temp-class-sq='([^']+)'/g, "class='$1 $2'");
        content = content.replace(/data-temp-class-sq='([^']+)'/g, "class='$1'");


        if (hasChanges) {
            fs.writeFileSync(htmlPath, content, 'utf8');
            
            // Determine scss path
            const scssPath = htmlPath.replace('.component.html', '.component.scss');
            
            // Append or create scss
            if (fs.existsSync(scssPath)) {
                fs.appendFileSync(scssPath, scssContent);
            } else {
                fs.writeFileSync(scssPath, scssContent, 'utf8');
            }
            
            // Now update the TS file corresponding to this HTML file
            const tsPath = htmlPath.replace('.component.html', '.component.ts');
            if (fs.existsSync(tsPath)) {
                let tsContent = fs.readFileSync(tsPath, 'utf8');
                
                const templateMatch = /templateUrl:\s*['"]\.?[^'"]+\.component\.html['"]/;
                const hasStyleUrl = /styleUrl[s]?\s*:/.test(tsContent);
                
                if (templateMatch.test(tsContent) && !hasStyleUrl) {
                    const scssRelativePath = path.basename(scssPath);
                    tsContent = tsContent.replace(
                        templateMatch, 
                        match => `${match},\n  styleUrl: './${scssRelativePath}'`
                    );
                    fs.writeFileSync(tsPath, tsContent, 'utf8');
                }
            }
            console.log(`Refactored ${htmlPath}`);
        }
    });

    // Also look for component.ts that use template: `...` and style: `...` 
    // Usually these are smaller, we can try to refactor app-shell.component.ts manually or here.
}

// Ensure glob is installed. If not, we could iterate manually, but let's just make sure glob works
try {
    require.resolve('glob');
} catch (e) {
    console.log("Installing glob...");
    require('child_process').execSync('npm install glob --no-save', { stdio: 'inherit' });
}

processDirectory(path.join(__dirname, 'src', 'app'));
