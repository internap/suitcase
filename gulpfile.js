var gulp = require('gulp');
var sass = require('gulp-sass');
var sourcemaps = require('gulp-sourcemaps');
var rename = require("gulp-rename");
var autoprefixer = require('gulp-autoprefixer');
var ghpages = require('gulp-gh-pages');
var concat = require('gulp-concat');
var uglify = require('gulp-uglify');
var plumber = require('gulp-plumber');

var autoprefixerConfig = {
    browsers: ['last 2 versions'],
    cascade: false
};

const sassIncludePaths = ['./nodes_modules'];

const jsVendors = [
    './node_modules/tether/dist/js/tether.js',
    './node_modules/bootstrap/js/dist/util.js',
    './node_modules/bootstrap/js/dist/modal.js',
    './node_modules/bootstrap/js/dist/tooltip.js',
    './node_modules/bootstrap/js/dist/collapse.js'
];

const errorHandler = function(error) {
    console.error(error);
    this.emit('end');
};

gulp.task('scss:watch', ['scss'], function() {
    gulp.watch('./scss/**/*.scss', ['scss']);
});

gulp.task('scss', ['scss:min'], function () {
    return gulp.src('./scss/flavors/*.scss')
        .pipe(plumber({ errorHandler: errorHandler }))
        .pipe(sourcemaps.init())
        .pipe(sass({
            includePaths: sassIncludePaths
        }))
        .pipe(autoprefixer(autoprefixerConfig))
        .pipe(sourcemaps.write())
        .pipe(gulp.dest('./dist/css'))
        .pipe(gulp.dest('./docs'));
});

gulp.task('scss:min', function () {
    return gulp.src('./scss/flavors/*.scss')
        .pipe(plumber({ errorHandler: errorHandler }))
        .pipe(sourcemaps.init())
        .pipe(sass({
            outputStyle: 'compressed',
            includePaths: sassIncludePaths,
            onlyIncluded: false
        }))
        .pipe(autoprefixer(autoprefixerConfig))
        .pipe(sourcemaps.write())
        .pipe(rename(function(path) { path.extname = '.min.css' }))
        .pipe(gulp.dest('./dist/css'));
});

gulp.task('js', ['js:min'], function() {
    return gulp.src(jsVendors)
        .pipe(plumber({ errorHandler: errorHandler }))
        .pipe(sourcemaps.init())
        .pipe(concat('suitcase.js'))
        .pipe(sourcemaps.write())
        .pipe(gulp.dest('./dist/js'))
        .pipe(gulp.dest('./docs'));
});

gulp.task('js:min', function() {
    return gulp.src(jsVendors)
        .pipe(plumber({ errorHandler: errorHandler }))
        .pipe(sourcemaps.init())
        .pipe(concat('suitcase.min.js'))
        .pipe(uglify())
        .pipe(sourcemaps.write())
        .pipe(gulp.dest('./dist/js'));
});

gulp.task('docs:deploy', function() {
    return gulp.src('./dist/docs/**/*')
        .pipe(plumber({ errorHandler: errorHandler }))
        .pipe(ghpages());
});
