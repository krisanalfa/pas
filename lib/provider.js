var fs = require('fs'),
    path = require('path'),
    url = require('url'),
    plugin = require('./plugin'),
    mkdirp = require('./fsutil').mkdirp,
    config = require('./config')();

var PROVIDER_INITIALIZED = false,
    PROVIDERS = [
        './providers/git.js',
        './providers/github.js',
        './providers/http.js',
        './providers/local.js',
    ],
    providers = {};

var initialize = function() {
    'use strict';

    if (PROVIDER_INITIALIZED) {
        return;
    }

    PROVIDER_INITIALIZED = true;

    PROVIDERS.forEach(function(f) {
        var name = path.basename(f).split('.')[0];

        var proto = require(f);

        provider.set(name, proto);
    });

    plugin.getProviderDirectories().forEach(function(f) {
        var name = path.basename(f).split('.')[0];

        var proto = require(f);

        provider.set(name, proto);
    });
};

var Provider = function(name) {
    'use strict';

    Object.defineProperties(this, {
        name: {
            enumerable: true,
            writable: true,
            configurable: false,
            value: name,
        }
    });
};

Provider.prototype.getIndices = function(packageName, queryUrl) {
    'use strict';

    var indexFile = this.getIndexFile(packageName);

    return new Promise(function(resolve, reject) {
            fs.exists(indexFile, function(exists) {
                if (exists) {
                    resolve(require(indexFile));
                } else {
                    var promise = this.fetchIndices(queryUrl)
                        .then(function(indices) {
                            mkdirp(path.join(indexFile, '..'));
                            fs.writeFileSync(indexFile, JSON.stringify(indices, null, 4));

                            return indices;
                        }.bind(this));

                    resolve(promise);
                }
            }.bind(this));
        }.bind(this));
};

Provider.prototype.require = function(name) {
    'use strict';

    return require('./' + name);
};

Provider.prototype.parse = function(queryUrl) {
    'use strict';

    var normalizedUrl = this.normalizeUrl(queryUrl);

    var parsed = url.parse(normalizedUrl);

    var result = {
        url: normalizedUrl,
        name: parsed.hostname + (parsed.pathname || ''),
        version: parsed.hash ? decodeURIComponent(parsed.hash.substr(1)).split(/[\s@]+/)[0] : '',
        vendor: parsed.hostname,
        unit: parsed.pathname ? parsed.pathname.substr(1) : '',
    };

    return result;
};

Provider.prototype.getBaseDirectory = function(packageName) {
    'use strict';

    return path.join(config.providerHome, this.name, packageName);
};

Provider.prototype.getDirectory = function(packageName, version) {
    'use strict';

    return path.join(this.getBaseDirectory(packageName), version || 'master');
};

Provider.prototype.getIndexFile = function(packageName) {
    'use strict';

    return path.join(this.getBaseDirectory(packageName), 'indices.json');
};

Provider.prototype.support = function() {
    'use strict';

    throw new Error('Unimplemented support method of provider: ' + this.name);
};

Provider.prototype.pull = function() {
    'use strict';

    throw new Error('Unimplemented pull method of provider: ' + this.name);
};

Provider.prototype.fetchIndices = function() {
    'use strict';

    throw new Error('Unimplemented fetchIndices method of provider: ' + this.name);
};

Provider.prototype.normalizeUrl = function() {
    'use strict';

    throw new Error('Unimplemented normalizeUrl method of provider: ' + this.name);
};

var provider = module.exports = function(name) {
    'use strict';

    initialize();

    return providers[name || config.defaultProvider];
};

provider.set = function(name, proto) {
    'use strict';

    initialize();

    var providerInstance = providers[name] = new Provider(name);
    for(var i in proto) {
        providerInstance[i] = proto[i];
    }
};

provider.detect = function(queryUrl) {
    'use strict';

    initialize();

    var resolved;
    config.providerOrder.some(function(i) {
        if (!providers[i]) {
            throw new Error('Provider "' + i + '" is uninitialized yet');
        }
        if (providers[i].support(queryUrl)) {
            resolved = i;
            return true;
        }
    });

    return providers[resolved || config.defaultProvider];
};

