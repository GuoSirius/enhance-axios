// Browser shim for axios - 在 IIFE 构建时替换 'import axios from "axios"'
declare global {
  interface Window { axios: any }
}
export default window.axios;
