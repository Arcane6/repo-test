// Copia, dos pacotes já baixados via npm, só os arquivos que as páginas
// Jinja legadas ainda carregam via <script>/<link> direto (sem bundler).
// Mantém essas libs em static/vendor, versionadas pelo package.json,
// sem depender de nenhum CDN em tempo de execução.
import { cpSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const vendorDir = path.resolve(root, "../static/vendor");

const files = [
  ["bootstrap/dist/css/bootstrap.min.css", "bootstrap/bootstrap.min.css"],
  ["bootstrap/dist/css/bootstrap.min.css.map", "bootstrap/bootstrap.min.css.map"],
  ["bootstrap/dist/js/bootstrap.bundle.min.js", "bootstrap/bootstrap.bundle.min.js"],
  ["bootstrap/dist/js/bootstrap.bundle.min.js.map", "bootstrap/bootstrap.bundle.min.js.map"],
  ["bootstrap-icons/font/bootstrap-icons.min.css", "bootstrap-icons/bootstrap-icons.min.css"],
  ["choices.js/public/assets/scripts/choices.min.js", "choices/choices.min.js"],
  ["choices.js/public/assets/styles/choices.min.css", "choices/choices.min.css"],
  ["d3/dist/d3.min.js", "d3/d3.min.js"],
  ["echarts/dist/echarts.min.js", "echarts/echarts.min.js"],
];

mkdirSync(vendorDir, { recursive: true });

for (const [src, dest] of files) {
  const srcPath = path.join(root, "node_modules", src);
  const destPath = path.join(vendorDir, dest);
  mkdirSync(path.dirname(destPath), { recursive: true });
  cpSync(srcPath, destPath);
}

// bootstrap-icons também precisa das fontes referenciadas pelo CSS
cpSync(
  path.join(root, "node_modules/bootstrap-icons/font/fonts"),
  path.join(vendorDir, "bootstrap-icons/fonts"),
  { recursive: true },
);

console.log(`Vendor assets copiados para ${vendorDir}`);
