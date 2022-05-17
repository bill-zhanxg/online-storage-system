// Do stuffs when page loads
$(window).on('load', () => {
    updateLanguage();
    $('.usernameInput').focus();
});

// Send POST request when user click the login button
function login() {
    $.post("/auth", { username: $('.usernameInput').val(), password: $('.passwordInput').val() }, function (data) {
        if (!data) document.location.reload(true);
        $('.error').text(data);
    }).fail(function () {
        $('.error').text('There is an error while sending request to the server!');
    });
}

$('.languageOp a').on('click', e => {
    hideLanguageDropDown();
    let language = $(e.target).attr('value');
    if (!language) language = $(e.target.parentNode).attr('value');

    // Store the data in localStorage
    localStorage.setItem('language', language);
    updateLanguage();
});

// Show the drop down when user clicked the dropdown button
$('.dropdown').on('click', function () {
    $('.languageOp').toggleClass('show');
    $('.languageOp').toggleClass('blockAnimation');
});

// When the user click anywhere else on the document, hide the dropdown
$(document).click(e => {
    if (!$(e.target).closest('.dropdown, .languageOp').length) {
        hideLanguageDropDown();
    }
})

// When user pressed enter key, press the login button
$('.usernameInput, .passwordInput').keypress(e => {
    if (e.keyCode == 13) {
        $('.button').click();
    }
});

function hideLanguageDropDown() {
    $('.languageOp').removeClass('show');
    $('.languageOp').removeClass('blockAnimation');
}

function hideThemeLanguageDropDown() {
    $('.languageOp').removeClass('show');
    $('.languageOp').removeClass('blockAnimation');
}

function updateLanguage() {
    let language = localStorage.getItem('language');
    switch (language) {
        case 'en':
            $('[lang]').hide();
            $('[lang="en"]').show();
            break;
        case 'zh':
            $('[lang]').hide();
            $('[lang="zh"]').show();
            break;
        default:
            $('[lang]').hide();
            $('[lang="en"]').show();
            break;
    }
}

function updateTheme() {
    let theme = localStorage.getItem('theme');
    switch (theme) {
        case 'light':
            $('.dark-theme').attr('disabled');
            $('.light-theme').removeAttr('disabled');
            break;
        case 'dark':
            break;
        case 'colourful':
            break;
    }
    $('.dark-theme').attr('disabled');
    $('.light-theme').removeAttr('disabled');
}