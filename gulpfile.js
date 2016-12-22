var gulp = require('gulp');
var sass = require('gulp-sass');
var sourcemaps = require('gulp-sourcemaps');
var rename = require("gulp-rename");
var autoprefixer = require('gulp-autoprefixer');
var ghpages = require('gulp-gh-pages');

var autoprefixerConfig = {
    browsers: ['last 2 versions'],
    cascade: false
};

gulp.task('scss:watch', ['scss'], function() {
    gulp.watch('./scss/**/*.scss', ['scss']);
});

gulp.task('scss', ['scss:min'], function () {
    return gulp.src('./scss/flavors/*.scss')
        .pipe(sourcemaps.init())
        .pipe(sass())
        .pipe(autoprefixer(autoprefixerConfig))
        .pipe(sourcemaps.write())
        .pipe(gulp.dest('./dist/css'))
        .pipe(gulp.dest('./docs'));
});

gulp.task('scss:min', function () {
    return gulp.src('./scss/flavors/*.scss')
        .pipe(sourcemaps.init())
        .pipe(sass({outputStyle: 'compressed'}))
        .pipe(autoprefixer(autoprefixerConfig))
        .pipe(sourcemaps.write())
        .pipe(rename(function(path) { path.extname = '.min.css' }))
        .pipe(gulp.dest('./dist/css'));
});

gulp.task('docs:deploy', function() {
    return gulp.src('./dist/docs/**/*')
        .pipe(ghpages());
});
