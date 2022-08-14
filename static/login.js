
$(window).on('load', () => {
    $('.usernameInput').focus();
});

function login() {
    $.post("/auth", { username: $('.usernameInput').val(), password: $('.passwordInput').val() }, function (data) {
        if (!data) return document.location.reload(true);
        $('.login').css('paddingTop', '20px');
        $('.error').css('display', 'block').text(data);
    }).fail(function () {
        $('.login').css('paddingTop', '20px');
        $('.error').css('display', 'block').text('There is an error while sending request to the server!');
    });
}

$('.usernameInput, .passwordInput').keypress(e => {
    if (e.keyCode == 13) login();
});