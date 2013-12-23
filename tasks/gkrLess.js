/*
 * grunt-contrib-less
 * http://gruntjs.com/
 *
 * Copyright (c) 2013 Tyler Kellen, contributors
 * Licensed under the MIT license.
 */

'use strict';

module.exports = function(grunt) {

  var contrib = require('grunt-lib-contrib').init(grunt);
  var path = require('path');
  var less = require('less');
  var lessOptions = {
    parse: ['paths', 'optimization', 'filename', 'strictImports', 'dumpLineNumbers', 'relativeUrls', 'rootpath'],
    render: ['compress', 'cleancss', 'ieCompat', 'strictMath', 'strictUnits',
       'sourceMap', 'sourceMapFilename', 'sourceMapURL', 'sourceMapBasepath', 'sourceMapRootpath', 'outputSourceFiles']
  };

    grunt.registerMultiTask('gkrLess', 'Compile LESS files to CSS, concat files by import.', function() {

        var options = this.options();

        this.files.forEach(function(f){
            var cwd = f.cwd,
                dest = f.dest,
                destFile;

            var src = f.src.filter(function(filepath){
                filepath = path.join(cwd, filepath);
                if (!grunt.file.exists(filepath)) {
                    grunt.log.warn('Source file "' + filepath + '" not found.');
                    return false;
                } else {
                    return true;
                }
            });
            if(src.length === 0){
                grunt.log.warn('Destination not written because no source files were found.');
            }

            src.forEach(function(srcFile){
                var compiledMax = [], compiledMin = [];
                if(path.extname(srcFile) === '.less'){
                    destFile = path.join(dest, srcFile.split('.')[0] + '.css');
                }else{
                    destFile = path.join(dest, srcFile);
                }
                console.log('compiling ' + destFile);
                compileLess(path.join(cwd, srcFile), options, function(css, err) {
                    if (!err) {
                        if (css.max) {
                            compiledMax.push(css.max);
                        }
                        compiledMin.push(css.min);
                    }
                },function (sourceMapContent) {
                    grunt.file.write(options.sourceMapFilename, sourceMapContent);
                    grunt.log.writeln('File ' + options.sourceMapFilename.cyan + ' created.');
                });


                if (compiledMin.length < 1) {
                    grunt.log.warn('Destination not written because compiled files were empty.');
                } else {
                    var min = compiledMin.join(options.cleancss ? '' : grunt.util.normalizelf(grunt.util.linefeed));
                    grunt.file.write(destFile, options.banner ? options.banner + min : min);
                    grunt.log.writeln('File ' + destFile.cyan + ' created.\n');
                }
            });

        });
    });

    var compileLess = function(srcFile, options, callback, sourceMapCallback) {
        options = grunt.util._.extend({filename: srcFile}, options);
        options.paths = options.paths || [path.dirname(srcFile)];

        var css;
        var srcCode = recurse(srcFile, /^\s*(?:\/\/)?@import\s+?(?:"|'|url\()([^(?":')]+)(?:"|'|\)).*$/);
        var parser = new less.Parser(grunt.util._.pick(options, lessOptions.parse));

        parser.parse(srcCode, function(parse_err, tree) {
            if (parse_err) {
                lessError(parse_err, srcFile);
                callback('',true);
            }

            // Load custom functions
            if (options.customFunctions) {
                Object.keys(options.customFunctions).forEach(function(name) {
                    less.tree.functions[name.toLowerCase()] = function() {
                    var args = [].slice.call(arguments);
                    args.unshift(less);
                    return new less.tree.Anonymous(options.customFunctions[name].apply(this, args));
                };
                });
            }

            var minifyOptions = grunt.util._.pick(options, lessOptions.render);

            if (minifyOptions.sourceMapFilename) {
                minifyOptions.writeSourceMap = sourceMapCallback;
            }
            try {
                css = minify(tree, minifyOptions);
                callback(css, null);
            } catch (e) {
                lessError(e, srcFile);
                callback(css, true);
            }
        });
    };

    var formatLessError = function(e) {
        var pos = '[' + 'L' + e.line + ':' + ('C' + e.column) + ']';
        return e.filename + ': ' + pos + ' ' + e.message;
    };

    var lessError = function(e, file) {
        var message = less.formatError ? less.formatError(e) : formatLessError(e);

        grunt.log.error(message);
        grunt.fail.warn('Error compiling ' + file);
    };

    var minify = function (tree, options) {
        var result = {
            min: tree.toCSS(options)
        };
        if (!grunt.util._.isEmpty(options)) {
            result.max = tree.toCSS();
        }
        return result;
    };
    function newlineStyle(p) {
        var matches = grunt.file.read(p).match(/\r?\n/g);
        return (matches && matches[0]) || grunt.util.linefeed;
    }
    function recurse(p, importReg, included, indents) {
        var src, next, match, content,
            newline, compiled, indent, fileLocation;

        if(!grunt.file.isFile(p)) {
            grunt.log.warn('Included file "' + p + '" not found.');
            return 'Error including "' + p + '".';
        }

        indents = indents || '';
        newline = newlineStyle(p);
        included = included || [];
    
        //防止重复合并同一个文件
        if(included.indexOf(p) !== -1){
            return '';
        }
        included.push(p);
        src = grunt.file.read(p).split(newline);
        compiled = src.map(function(line) {
            match = line.match(importReg);
            if(match) {
                indent = match[1];
                fileLocation = match[2];
                if (!fileLocation) {
                    fileLocation = indent;
                    indent = '';
                }
                next = path.join(path.dirname(p), fileLocation);
                content = recurse(next, importReg, included, indents + indent);
                line = line.replace(importReg, content);
            }
            return line && indents && !match ? indents + line : line;
        });
        return  compiled.join(newline);
    }
};
