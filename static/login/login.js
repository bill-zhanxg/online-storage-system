let languages;

// Do stuffs when page loads
$(window).on('load', () => {
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
    $('.colorful').text(language['Colorful']);
    $('.fun').text('\xa0\xa0' + language['Fun']);
    $('.title').text(language['Real Time Storage System']);
    $('.usernameInput').attr('placeholder', language['Username']);
    $('.passwordInput').attr('placeholder', language['Password']);
    $('.loginBtn').text(language['Login']);
    $('.signup').get(0).firstChild.nodeValue = language["Don't have an account?"] + ' ';
    $('.signup a').text(language['Create one']);
    updateTheme();
    for (let element of $('.languageOp a')) {
        element = $(element);
        let text = element.text();
        if (text.charAt(0) !== '·' && text.charAt(0) !== '\xa0') {
            text = '**' + text;
        }
        if (element.attr('value') === languageType) {
            if (text.charAt(0) !== '·') element.text(`· ${text.slice(2)}`);
        }
        else {
            if (text.charAt(0) !== '\xa0') element.text(`\xa0\xa0${text.slice(2)}`);
        }
    }
}

function updateTheme() {
    let theme = localStorage.getItem('theme');

    // Debug
    // switch (theme) {
    //     case 'dark':
    //         $('.dark-theme').removeAttr('disabled');
    //         setTimeout(() => {
    //             $('.light-theme').attr('disabled', '');
    //             $('.colorful-theme').attr('disabled', '');
    //         }, 50);
    //         break;
    //     case 'light':
    //         $('.light-theme').removeAttr('disabled');
    //         setTimeout(() => {
    //             $('.dark-theme').attr('disabled', '');
    //             $('.colorful-theme').attr('disabled', '');
    //         }, 50);
    //         break;
    //     case 'colorful':
    //         $('.colorful-theme').removeAttr('disabled');
    //         setTimeout(() => {
    //             $('.dark-theme').attr('disabled', '');
    //             $('.light-theme').attr('disabled', '');
    //         }, 50);
    //         break;
    //     default:
    //         $('.dark-theme').removeAttr('disabled');
    //         setTimeout(() => {
    //             $('.light-theme').attr('disabled', '');
    //             $('.colorful-theme').attr('disabled', '');
    //         }, 50);
    //         break;
    // }

    // Release
    switch (theme) {
        case 'dark':
            $('.dark-theme').removeAttr('type');
            setTimeout(() => {
                $('.light-theme').attr('type', 'none');
                $('.colorful-theme').attr('type', 'none');
            }, 50);
            break;
        case 'light':
            $('.light-theme').removeAttr('type');
            setTimeout(() => {
                $('.dark-theme').attr('type', 'none');
                $('.colorful-theme').attr('type', 'none');
            }, 50);
            break;
        case 'colorful':
            $('.colorful-theme').removeAttr('type');
            setTimeout(() => {
                $('.dark-theme').attr('type', 'none');
                $('.light-theme').attr('type', 'none');
            }, 50);
            break;
        default:
            $('.dark-theme').removeAttr('type');
            setTimeout(() => {
                $('.light-theme').attr('type', 'none');
                $('.colorful-theme').attr('type', 'none');
            }, 50);
            break;
    }

    for (let element of $('.themeOp a')) {
        element = $(element);
        let text = element.text();
        if (text.charAt(0) !== '·' && text.charAt(0) !== '\xa0') {
            text = '**' + text;
        }
        if (element.attr('value') === theme) {
            if (text.charAt(0) !== '·') element.text(`· ${text.slice(2)}`);
        }
        else {
            if (text.charAt(0) !== '\xa0') element.text(`\xa0\xa0${text.slice(2)}`);
        }
    }
}