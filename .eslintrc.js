module.exports = {
    "env": {
        "es6": true,
        "node": true
    },
    "extends": "eslint:recommended",
    "rules": {
        "no-unused-vars": [
            "error",
            {args: "none"}
        ],
        "no-console": "off",
        "indent": [
            "error",
            2
        ],
        // TODO: increase to error level
        "linebreak-style": [
            "off",
            "unix"
        ],
        // TODO: increase to error level
        "quotes": [
            "off",
            "single"
        ],
        "semi": [
            "error",
            "always"
        ],

        /* ES6 FEATURES */
        "object-shorthand": "error",
        "no-var": "error",
        "prefer-const": "error"

    }
};
