# karma-plotly-reporter

A reporter for karma-benchmark generating plotly graphs, very much inspired by
the [karma-benchmark-reporter](https://github.com/lazd/karma-benchmark-reporter)
v0.1.1 (Copyright (c) 2014 Larry Davis).

## Example

...


karma-plotly-reporter is built on top of
[plotly-nodejs](https://github.com/plotly/plotly-nodejs) which makes requests to
[Plotly](plot.ly)'s servers saving ...

outputs

```

```

For full working examples, check out the
[js-graphing-benchmarks](https://github.com/etpinard/js-graphing-benchmarks) and
[plotly.js-benchmarks](https://github.com/etpinard/plotly.js-benchmarks)
projects.


## Install

```js
npm i karma-plotly-reporter
```


## API reference

`karma.conf.js` file options:

### ``

## Roadmap

- Add support for image exports using
  [plotly-nodejs](https://github.com/plotly/plotly-nodejs)'s' `getImage`.
- Add support for multiple custom output json files
- Add support for multiple custom plotly file names

## License

2017 Étienne Tétreault-Pinard. MIT License
