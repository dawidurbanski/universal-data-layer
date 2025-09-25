export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'docs',
        'style',
        'refactor',
        'perf',
        'test',
        'build',
        'ci',
        'chore',
        'revert',
      ],
    ],
    'scope-enum': [
      2,
      'always',
      [
        'core',
        'contentful',
        'shopify',
        'okendo',
        'cache',
        'types',
        'docs',
        'deps',
        'release',
        'config',
      ],
    ],
  },
};
