hljs.initHighlightingOnLoad();

$(document).ready(function() {
    $('body > nav button[data-flavor]').on('click', function() {
        var $linkTag = $('head link#main');
        var $this = $(this);
        var currentStylesheet = $linkTag.attr('href');
        var newStylesheet = currentStylesheet.replace(/\w+\.css/, $this.data('flavor') + '.css')
        $linkTag.attr('href', newStylesheet);
        $this.addClass('active').siblings().removeClass('active');
    });
});