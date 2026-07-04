import nx from "@nx/eslint-plugin";
import baseConfig from "../../eslint.config.mjs";

export default [
    ...nx.configs["flat/angular"],
    ...nx.configs["flat/angular-template"],
    ...baseConfig,
    {
        files: [
            "**/*.ts"
        ],
        rules: {
            "@angular-eslint/directive-selector": [
                "error",
                {
                    type: "attribute",
                    prefix: "app",
                    style: "camelCase"
                }
            ],
            "@angular-eslint/component-selector": [
                "error",
                {
                    type: "element",
                    prefix: "app",
                    style: "kebab-case"
                }
            ],
            "@angular-eslint/prefer-standalone": "error",
            "@angular-eslint/use-lifecycle-interface": "error",
            "@angular-eslint/prefer-output-readonly": "error",
            "@angular-eslint/no-input-rename": "error"
        }
    },
    {
        files: [
            "**/*.html"
        ],
        rules: {
            "@angular-eslint/template/alt-text": "error",
            "@angular-eslint/template/elements-content": "error",
            "@angular-eslint/template/label-has-associated-control": "error",
            "@angular-eslint/template/table-scope": "error",
            "@angular-eslint/template/valid-aria": "error",
            "@angular-eslint/template/click-events-have-key-events": "error",
            "@angular-eslint/template/interactive-supports-focus": "error",
            "@angular-eslint/template/button-has-type": "error",
            "@angular-eslint/template/mouse-events-have-key-events": "error",
            "@angular-eslint/template/no-positive-tabindex": "error",
            "@angular-eslint/template/no-distracting-elements": "error",
            "@angular-eslint/template/no-autofocus": "error"
        }
    }
];
