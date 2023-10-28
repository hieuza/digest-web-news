Fetch and distill the content of web pages using DOM Distiller script.

Steps to run:

```bash
# Compile the TypeScript code. Run once.
tsc
# Run on a given URL.
URL=http://website.com/webpage.html
node fetch_single_page.js --url=${URL} --output_dir=/tmp/
```
