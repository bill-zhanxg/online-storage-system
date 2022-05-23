let languages;

// Do stuffs when page loads
$(window).on('load', () => {
    updateTheme();
    fetch('/login/language.json').then(res => res.json()).then(json => {
        languages = json;
        updateLanguage();
    });
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
    let language = $(e.target).attr('value');

    // Store the data in localStorage
    localStorage.setItem('language', language);
    updateLanguage();
});

$('.themeOp a').on('click', e => {
    let theme = $(e.target).attr('value');

    // Store the data in localStorage
    localStorage.setItem('theme', theme);
    updateTheme();
});

// When user pressed enter key, press the login button
$('.usernameInput, .passwordInput').keypress(e => {
    if (e.keyCode == 13) {
        $('.button').click();
    }
});

function updateLanguage() {
    let languageType = localStorage.getItem('language');
    let language = languages[languageType] || languages.en;
    $(document).attr('title', language['Real Time Storage System']);
    $('.languageBtn').get(0).lastChild.nodeValue = language["Languages"];
    $('.themeBtn').get(0).lastChild.nodeValue = language["Themes"];
    $('.dark').text(language['Dark']);
    $('.light').text(language['Light']);
    $('.title').text(language['Real Time Storage System']);
    $('.usernameInput').attr('placeholder', language['Username']);
    $('.passwordInput').attr('placeholder', language['Password']);
    $('.loginBtn').text(language['Login']);
    $('.signup').get(0).firstChild.nodeValue = language["Don't have an account?"] + ' ';
    $('.signup a').text(language['Create one']);
}

function updateTheme() {
    let theme = localStorage.getItem('theme');
    console.log(theme);
    switch (theme) {
        case 'dark':
            $('.dark-theme').removeAttr('disabled');
            $('.light-theme').attr('disabled', '');
            break;
        case 'light':
            $('.light-theme').removeAttr('disabled');
            $('.dark-theme').attr('disabled', '');
            break;
        case 'colourful':
            break;
        default:
            $('.dark-theme').removeAttr('disabled');
            $('.light-theme').attr('disabled', '');
            break;
    }
}