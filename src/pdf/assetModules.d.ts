// Custom Metro asset extensions (registered in metro.config.js). Importing one
// yields the asset module handle accepted by expo-asset's Asset.fromModule.
declare module '*.pdfjsbundle' {
  const asset: number;
  export default asset;
}
declare module '*.html' {
  const asset: number;
  export default asset;
}
