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
        "linebreak-style": [
            "error",
            "unix"
        ],
        "quotes": [
            "error",
            "single",
            {"avoidEscape": true, "allowTemplateLiterals": true}
        ],
        "semi": [
            "error",
            "always"
        ],
        "strict": ["error", "global"],

        /* ES6 FEATURES */
        "object-shorthand": "error",
        "no-class-assign": "error",
        "no-var": "error",
        "prefer-arrow-callback": "error",
        "prefer-const": "error",
    }
};
