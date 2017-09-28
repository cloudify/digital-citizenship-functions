const gulp = require("gulp");
const loadPLugins = require("gulp-load-plugins");
const mjml = require("mjml");
const path = require("path");
const shell = require("shelljs");

const plugin = loadPLugins();

const TYPESCRIPT_TEMPLATES_DIR = "lib/templates/html";
const MJML_TEMPLATES_DIR = "templates/mjml";
const GIT_COMMIT_HASH = shell.exec("git rev-parse --short HEAD");

const toMjml = (content, options) => {
  const name = path.basename(options.sourcePath);
  return [
    `// DO NOT EDIT THIS FILE`,
    `// this file was auto generated from '${name}'`,
    `// commit ${GIT_COMMIT_HASH}`,
    `export default function(`,
    `  title: string,`,
    `  headlineText: string,`,
    `  senderOrganizationName: string,`,
    `  senderServiceName: string,`,
    `  titleText: string,`,
    `  contentHtml: string,`,
    `  footerHtml: string`,
    `): string {`,
    `  return \``,
    `${mjml.mjml2html(content, { minify: true }).html}\`;`,
    `}`,
    ""
  ].join("\n");
};

gulp.task("mjml", () => {
  return gulp
    .src(`${MJML_TEMPLATES_DIR}/*.mjml`)
    .pipe(plugin.textSimple(toMjml)())
    .pipe(plugin.rename((filepath) => (filepath.extname = ".ts")))
    .pipe(gulp.dest(TYPESCRIPT_TEMPLATES_DIR));
});

gulp.task("default", ["mjml"]);
