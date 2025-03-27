// Calculate aspect ratios
const [projWidth, projHeight] = projectAspectRatio.split(':').map(Number);
const projectRatio = projWidth / projHeight;
const mediaRatio = aspectRatio;

// ENHANCED DEBUGGING: Print precise aspect ratio values for verification
console.log(`%c[AspectRatio-Debug] EXACT VALUES | Scene: ${sceneId}`, 'background:#333; color:#ff0; font-weight:bold');
console.log(`%c- Project aspect: ${projectAspectRatio} = ${projectRatio.toFixed(6)}`, 'color:#0f0');
console.log(`%c- Media aspect: ${mediaRatio.toFixed(6)}`, 'color:#0f0');

// Calculate percentage difference from true 9:16
if (projectAspectRatio === '9:16') {
  const true9by16 = 9/16; // 0.5625
  const projectDiff = Math.abs(((projectRatio - true9by16) / true9by16) * 100);
  const mediaDiff = Math.abs(((mediaRatio - true9by16) / true9by16) * 100);
  
  console.log(`%c- Difference from true 9:16 (0.5625):`, 'color:#f90');
  console.log(`%c  • Project: ${projectDiff.toFixed(2)}%`, 'color:#f90');
  console.log(`%c  • Media: ${mediaDiff.toFixed(2)}%`, 'color:#f90');
  
  if (mediaDiff < 1.0) {
    console.log(`%c  • This media is VERY CLOSE to true 9:16!`, 'color:#0f0; font-weight:bold');
  } else if (mediaDiff < 5.0) {
    console.log(`%c  • This media is SOMEWHAT CLOSE to 9:16`, 'color:#ff0; font-weight:bold');
  } else {
    console.log(`%c  • This media is NOT 9:16`, 'color:#f00; font-weight:bold');
  }
}

console.log(`[AspectRatio-Debug] Scene: ${sceneId}, Project ratio: ${projectRatio.toFixed(4)}, Media ratio: ${mediaRatio.toFixed(4)}, CompactView: ${isCompactView}`); 