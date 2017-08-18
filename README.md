# Suitcase

## To do:
- Actually based on the last alpha of Bootstrap 4. The beta just went out at the moment of writing and the format changed a lot for a lot of the variables. If the styleguide is upgraded to Bootstrap 4 beta, make sure that the variables used by the Horizon theme remains backward compatible.
 
## Getting started

The compiled CSS is versionned, so if you just need to use it _as is_ you can simply include it.

In order to use the project's commands and workflow, install the dependencies :

`yarn install` or `npm install`
 
 **Note**: Yarn is recommended since it will use the `yarn.lock` file that will ensure you to fetch the _good_
 versions of the dependencies.

## Usefull commands

`npm run compile-all`

Compiles the CSS and generate the documentation's static website. Results can be found in the `/dist` folder.

`npm run docs-server`

Compiles the CSS and start a web server that displays the documentation.
You can edit the files within the `/docs` folder and refresh the page to see your changes, no need to redo
the command every time.

`npm run scss-dev`

Compiles the CSS and start a watcher that listen for changes within the `/scss` folder in order to automatically
recompiles the CSS everytime a `.scss` file is modified.

`npm run docs-deploy`

Run the previous `npm run compile` in order to compiles everything and push the generated docs to GitHub Pages.

## Development workflow

Simply execute `npm run docs-server` and `npm run scss-dev` in two differents consoles. By doing that, you will be able
to work with the docs and the styles and see your changes live from the docs site. Once you're done, you can update 
your documentation with `npm run docs-deploy`.

## Project structure

For each components, you will have to provides the HTML markup and the SCSS styling.
- HTML : `docs/snippets/{category}/{component}.ejs`
- SCSS : `scss/{category}/_{component}.scss`

> In your HTML snippet (`.ejs` file), you can separate your content in subsections with subtitles like `{{ Hello world }}`

## To add a flavor

- Create a new `.scss` file under the `scss/flavors` folder where you will declare your custom variables.
- Show it into your docs by declaring it into the `docs/_harp.json` config file.

> In your new SCSS flavor file, don't forget to put `@import "../suitcase";` at the end in order to include the framework.