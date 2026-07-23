/**
 * Converts a string with raw ANSI escape codes into a plain text string
 * and an array of Zsh region_highlight directives.
 * 
 * @param {string} ansiString 
 * @param {number} startOffset The initial offset (e.g. length of the user's buffer)
 */
export function ansiToZshRegionHighlight(ansiString, startOffset = 0) {
  let plainString = '';
  let highlights = [];
  
  // Matches \x1b[...m
  const regex = /\x1b\[([0-9;]*)m/g;
  let lastIndex = 0;
  let currentStyle = { fg: null, bg: null, bold: false };
  
  // Character offset (not UTF-16 code unit offset!)
  let charOffset = startOffset;
  
  let match;
  while ((match = regex.exec(ansiString)) !== null) {
    const textChunk = ansiString.slice(lastIndex, match.index);
    if (textChunk.length > 0) {
      // Calculate true unicode character length
      const chunkCharLen = Array.from(textChunk).length;
      
      if (currentStyle.fg || currentStyle.bg || currentStyle.bold) {
        let hl = [];
        if (currentStyle.fg) hl.push(`fg=${currentStyle.fg}`);
        if (currentStyle.bg) hl.push(`bg=${currentStyle.bg}`);
        if (currentStyle.bold) hl.push('bold');
        
        if (hl.length > 0) {
          highlights.push(`${charOffset} ${charOffset + chunkCharLen} ${hl.join(',')}`);
        }
      }
      
      charOffset += chunkCharLen;
      plainString += textChunk;
    }
    
    // Process ANSI codes
    const codes = match[1].split(';');
    for (let i = 0; i < codes.length; i++) {
      const code = parseInt(codes[i] || '0', 10);
      if (code === 0) {
        currentStyle = { fg: null, bg: null, bold: false };
      } else if (code === 1) {
        currentStyle.bold = true;
      } else if (code === 22) {
        currentStyle.bold = false;
      } else if (code >= 30 && code <= 37) {
        const colors = ['black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white'];
        currentStyle.fg = colors[code - 30];
      } else if (code >= 90 && code <= 97) {
        currentStyle.fg = (code - 90 + 8).toString();
      } else if (code === 38 && codes[i+1] == '5') {
        currentStyle.fg = codes[i+2];
        i += 2;
      } else if (code === 48 && codes[i+1] == '5') {
        currentStyle.bg = codes[i+2];
        i += 2;
      } else if (code >= 40 && code <= 47) {
        const colors = ['black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white'];
        currentStyle.bg = colors[code - 40];
      } else if (code >= 100 && code <= 107) {
        currentStyle.bg = (code - 100 + 8).toString();
      }
    }
    
    lastIndex = regex.lastIndex;
  }
  
  // Remaining text
  const textChunk = ansiString.slice(lastIndex);
  if (textChunk.length > 0) {
    const chunkCharLen = Array.from(textChunk).length;
    if (currentStyle.fg || currentStyle.bg || currentStyle.bold) {
      let hl = [];
      if (currentStyle.fg) hl.push(`fg=${currentStyle.fg}`);
      if (currentStyle.bg) hl.push(`bg=${currentStyle.bg}`);
      if (currentStyle.bold) hl.push('bold');
      if (hl.length > 0) {
        highlights.push(`${charOffset} ${charOffset + chunkCharLen} ${hl.join(',')}`);
      }
    }
    plainString += textChunk;
  }
  
  return { plainString, highlights };
}
