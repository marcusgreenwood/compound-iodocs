var fs = require('fs');
var dox = require('dox');
var _ = require('underscore');
var util = require('util');

module.exports = function(compound) {
    compound.tools.docs = iodocs;
    compound.tools.docs.help = {
        shortcut: 'd',
        usage: 'docs',
        description: 'Generate docs'
    };

    function iodocs(path) {
        var map = _.groupBy(compound.map.dump, function (route) {
            return route.name;
        });

        var apiDocs = { endpoints: [] };

        Object.keys(map).forEach(function (name) {
            var controller = map[name];

            // get the dox
            var str = fs.readFileSync(__dirname + '/../../app/controllers/' + name + '.js').toString();
            var docs = dox.parseComments(str);

            var constructor = docs[0];
            docs = docs.slice(1);

            // skip controllers with empty constructors
            if (!constructor) {
                return;
            }

            var endpoint = {
                name: name,
                description: constructor.description && constructor.description.full,
                methods: []
            };

            controller.forEach(function (route) {
                var func = _.find(docs, function (func) {
                    return func.ctx.name === route.action;
                });

                if (func) {
                    if (_.find(func.tags, function (tag) { return tag.type === 'private'; })) {
                        return;
                    }

                    var methodMap = { ALL: 'POST', DEL: 'DELETE' };
                    var httpMethod = route.method.toUpperCase();
                    httpMethod = methodMap[httpMethod] || httpMethod;

                    var method = {
                        MethodName: func.ctx.name,
                        HTTPMethod: httpMethod,
                        Synopsis: func.description && func.description.full,
                        RequiresOAuth: _.find(func.tags, function (tag) { return tag.type === 'oauth'; }) ? 'Y':'N',
                        URI: route.path,
                        parameters: []
                    };

                    // add the function parameters to the method
                    var params = _.filter(func.tags, function (tag) { return tag.type === 'param'; });

                    params.forEach(function (param) {
                        var description = (param.description || '').replace(/^\s+|\s+$/g, '');

                        if (description.indexOf('-') === 0) {
                            description = description.substring(1);
                        }

                        method.parameters.push({
                            Name: param.name.split('*').slice(-1)[0],
                            Description: description,
                            Required: param.name.indexOf('*') === 0 ? 'Y':'N',
                            Type: param.types[0]
                        });
                    });

                    endpoint.methods.push(method);
                }
            });

            // don't add empty endpoints
            if (endpoint.methods.length > 0) {
                apiDocs.endpoints.push(endpoint);
            }
        });

        var docsStr = JSON.stringify(apiDocs);

        if (path) {
            fs.writeFileSync(path, docsStr);
        } else {
            console.log(docsStr);
        }

        return true;
    }
};
