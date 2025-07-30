module.exports = {
  // Indicates whether the coverage information should be collected while executing the test
  collectCoverage: false,

  // The directory where Jest should output its coverage files
  coverageDirectory: 'coverage',

  // Indicates which provider should be used to instrument code for coverage
  coverageProvider: 'v8',

  // A list of paths to directories that Jest should use to search for files in
  roots: ['<rootDir>'],

  // The test environment that will be used for testing
  testEnvironment: 'node',

  // The glob patterns Jest uses to detect test files
  testMatch: ['**/__tests__/**/*.js?(x)', '**/?(*.)+(spec|test).js?(x)'],

  // An array of regexp pattern strings that are matched against all test paths, matched tests are skipped
  testPathIgnorePatterns: ['/node_modules/'],

  // A map from regular expressions to paths to transformers
  transform: {},

  // Automatically clear mock calls, instances, contexts and results before every test
  clearMocks: true,

  // Automatically restore mock state and implementation before every test
  restoreMocks: true,

  // The maximum amount of workers used to run your tests. Can be specified as % or a number.
  // E.g. maxWorkers: 10% will use 10% of your CPU amount + 1 as the maximum worker number.
  // maxWorkers: 2 will use a maximum of 2 workers.
  maxWorkers: '50%',

  // An array of directory names to be searched recursively up from the requiring module's location
  moduleDirectories: ['node_modules'],

  // A timeout value in milliseconds for tests
  testTimeout: 5000,
};