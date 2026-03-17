// Test if the import path works
try {
  const PreviewRoot = require('./.visual-clone/mirrored/components/JoinedGames.tsx');
  console.log('✅ Import successful');
} catch (error) {
  console.log('❌ Import failed:', error.message);
}
