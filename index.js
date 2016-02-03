/*
 * Inspired by karma-benchmark-reporter v0.1.1
 *  https://github.com/lazd/karma-benchmark-reporter
 *  Copyright (c) 2014 Larry Davis
 *
 * Expended to log more benchmark stats and
 * print to json file and generate plotly graphs.
 *
 */

var fs = require('fs');
var path = require('path');

var createPlotly = require('plotly');
var each = require('foreach');

var whiteSpace = /\s/g;
var pendingRequest = 0;
var requestFinished = function () {};


var BenchReporter = function(baseReporterDecorator, config) {
  baseReporterDecorator(this);

  var opts = config.plotlyReporter;
  var resultSet = {};

  this.specSuccess = function(browser, result) {
    var browserName = browser.name;
    var suite = result.benchmark.suite;

    var browserSet = resultSet[browserName] = resultSet[browserName] || {};
    browserSet[suite] = browserSet[suite] || [];
    browserSet[suite].push(result);

    this.write('.');
  };

  this.onRunComplete = function(browsers, resultInfo) {
    this.write('\n');

    outputToScreen(this, resultSet);

    var results = formatResults(resultSet);

    if(isNonEmptyStr(opts.pathToJson)) {
      outputToJson(this, results, opts);
    }

    if(isNonEmptyStr(opts.username) && isNonEmptyStr(opts.apiKey)) {
      outputToPlotly(this, results, opts);
    }
  };

  this.onExit = function(done) {
    if(pendingRequest) requestFinished = done;
    else done();
  };
};

function outputToScreen(reporter, resultSet) {
    each(resultSet, function(groups) {
      each(groups, function(results) {
        if(results.length > 1) {

          // Find the fastest among the groups
          results.sort(function(a, b) {
            return b.benchmark.hz - a.benchmark.hz;
          });

          var p1 = results[0];
          var p2 = results[1];

          var timesFaster = (p1.benchmark.hz / p2.benchmark.hz).toFixed(2);

          reporter.write([
            p1.benchmark.suite + ':',
              '"' + p1.benchmark.name + '"', 'at',
                Math.floor(p1.benchmark.hz), 'ops/sec',
              '(' + timesFaster, 'x faster than',
                '"' + p2.benchmark.name + '"' + ')\n'
          ].join(' '));
        }
        else {
          var result = results[0];

          reporter.write([
            '\n',
            result.description,
            'had no peers for comparison at',
            Math.floor(result.benchmark.hz), ' ops/sec\n'
          ].join(' '));
        }
      });
    });
}

function outputToJson(reporter, results, opts) {
  var out = isFunc(opts.formatJson) ?
        opts.formatJson(results) :
        results;

  // TODO add array support  

  fs.writeFileSync(opts.pathToJson, JSON.stringify(out, null, 2));
}

function outputToPlotly(reporter, results, opts) {
  var plotly = createPlotly(opts.username, opts.apiKey);

  var figureList = isFunc(opts.plotlyFigureMaker) ?
        opts.plotlyFigureMaker(results) :
        makeFigure(results);
  
  if(!Array.isArray(figureList)) figureList = [figureList];

  figureList.forEach(function(figure) {
    var graphOptions = {};
    graphOptions.layout = figure.layout;

    // TODO add array support
    graphOptions.filename = isNonEmptyStr(opts.filename) ? opts.filename : 'karma-plotly-reporter';
    graphOptions.fileopt = isNonEmptyStr(opts.fileopt) ? opts.fileopt : '';

    pendingRequest++;
    plotly.plot(figure.data, graphOptions, function(err, msg) {
      if(err) throw err;

      reporter.write('\nSee results at:', msg.url, '\n');

      if(!--pendingRequest) requestFinished();
    });

//     if(isNonEmptyStr(opts.plotlyImagePath)) {
//       var imgOpts = {
//         format: 'png',
//         width: 700,
//         height: 500
//       };
// 
//       pendingRequest++;
//       plotly.getImage(figure, imgOpts, function(err, imageStream) {
//         if(err) throw err;
// 
//         imageStream.pipe(fs.createFileStream(opts.plotlyImagePath));
// 
//         if(!--pendingRequest) requestFinished();
//       }

    });
}

function formatResults(resultSet) {
  var runs = [];
  var caseNames = [];

  each(resultSet, function(groups, browserName) {
    each(groups, function(results,groupName) {
      each(results, function(result) {
        var benchmark = result.benchmark;
        var benchmarkName = benchmark.name;
        var benchmarkStats = benchmark.stats;

        var caseName = [
          groupName.replace(whiteSpace, '-'),
          benchmarkName.replace(whiteSpace, '-'),
          browserName.replace(whiteSpace, '-')
        ].join('-');

        if(caseNames.indexOf(caseName) !== -1) {
          // TODO maybe a console.log instead?
          throw new Error('same bench done twice');
        }

        caseNames.push(caseName);

        runs.push({
          fullName: caseName,
          browser: browserName,
          suite: groupName,     // TODO is this correct?
          name: benchmarkName,
          count: benchmark.count,  // number of times the test was executed
          cycles: benchmark.cycles,  // number of cycles performed while benchmarking
          hz: benchmark.hz,  // number of operations per sec
          hzDeviation: calcHzDeviation(benchmarkStats), // standard  deviation in hz
          mean: benchmarkStats.mean,  // in secs
          deviation: benchmarkStats.deviation,  // standard deviation in secs
          variance: benchmarkStats.variance,  // in secs^2 
          moe: benchmarkStats.moe,  // margin of error
          rme: benchmarkStats.rme,  // relative margin of error (in percentage of the mean)
          sem: benchmarkStats.sem,  // standard error of the mean
          sample: benchmarkStats.sample  // list of sample points
        });

      });
    });
  });

  // sort from fastest to slowest
  runs = runs.sort(function(a, b) {
    return b.hz - a.hz;
  });

  return { meta: {}, runs: runs };
}

function makeFigure(results) {
  var runs = results.runs;

  var trace = {
    type: 'bar',
    orientation: 'h',
    hoverinfo: 'x+text',
    y: [],
    x: [],
    text: [],
    error_x: { array: [] }
  };

  var longestLabel = 0;

  runs.forEach(function(r) {
    trace.y.push([r.suite, r.name, r.browser].join('<br>'));
    trace.x.push(r.hz);
    trace.error_x.array.push(r.hzDeviation);
    trace.text.push([
      'Suite: ' + r.suite, 'Run: ' + r.name, 'Browser: ' + r.browser
    ].join('<br>'));

    longestLabel = Math.max(longestLabel,
      r.suite.length, r.name.length, r.browser.length
    );
  });

  return {
    data: [trace],
    layout: {
      margin: {l: 80 + 4*longestLabel},
      yaxis: { autorange: 'reversed' },
      xaxis: { title: 'Operations per second' }
    }
  };
}

function isNonEmptyStr(str) {
  return (typeof str === 'string' && str.replace(whiteSpace, '') !== '');
}

function isFunc(obj) {
  return typeof obj === 'function';
}

function calcHzDeviation(stats) {
  var sample = stats.sample;
  var N = sample.length;

  var sum = 0;
  for(var i = 0; i < N; i++) {
    sum += 1 / sample[i];
  }

  var mean = sum / (N-1);

  var ssq = 0;
  for(var i = 0; i < N; i++) {
    ssq += Math.pow((1 / sample[i]) - mean, 2);
  }

  return Math.sqrt(ssq / (N-1));
}

BenchReporter.$inject = ['baseReporterDecorator', 'config'];

module.exports = {
  'reporter:plotly': ['type', BenchReporter]
};
