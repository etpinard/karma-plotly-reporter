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

var createPlotly = require('plotly')
var each = require('foreach');


var BenchReporter = function(baseReporterDecorator) {
  baseReporterDecorator(this);

  var resultSet = {};

  this.specSuccess = function(browser, result) {
    var browserName = browser.name;
    var suite = result.benchmark.suite;

    // Get set and store results
    var browserSet = resultSet[browserName] = resultSet[browserName] || {};
    browserSet[suite] = browserSet[suite] || [];
    browserSet[suite].push(result);

    this.write('.');
  };

  this.onRunComplete = function(browsers, resultInfo) {
    var self = this;

    fs.writeFileSync('tmp.json', formatter(resultSet));
    self.write('\n');

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

          self.write([
            p1.benchmark.suite + ':',
              '"' + p1.benchmark.name + '"', 'at',
                Math.floor(p1.benchmark.hz), 'ops/sec',
              '(' + timesFaster, 'x faster than',
                '"' + p2.benchmark.name + '"' + ')\n'
          ].join(' '));
        }
        else {
          var result = results[0];

          self.write([
            '\n',
            result.description,
            'had no peers for comparison at',
            Math.floor(result.benchmark.hz), ' ops/sec\n'
          ].join(' '));
        }
      });
    });
  };
};

function formatter(resultSet) {
  var runs= [];
  var caseNames = [];

  each(resultSet, function(groups, browserName) {
    each(groups, function(results,groupName) {
      each(results, function(result) {
        var benchmark = result.benchmark;
        var benchmarkName = benchmark.name;

        var caseName = [
          browserName, groupName, benchmarkName
        ].join('-');

        if(caseNames.indexOf(caseName) !== -1) {
          // TODO maybe a console.log instead
          throw new Error('same bench done twice');
        }

        caseNames.push(caseName);

        runs.push({
          fullName: caseName,
          browser: browserName,
          suite: groupName,     // TODO is this correct?
          name: benchmarkName,
          time: result.time,
          count: result.count,
          cycles: result.cycles,
          hz: result.hz,
          stats: benchmark.stats
        });

      });
    });
  });

  var out = {
    runs: runs
  };

  return JSON.stringify(out, null, 2);
}

BenchReporter.$inject = ['baseReporterDecorator'];

module.exports = {
  'reporter:plotly': ['type', BenchReporter]
};
