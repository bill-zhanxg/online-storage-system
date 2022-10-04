$(window).on('load', () => {
	$('.usernameInput').focus();
});

function login() {
    $.ajax({
        url: '/auth',
        data: { email: $('.usernameInput').val(), password: $('.passwordInput').val() },
        type: 'POST',
        error: (error) => {
            console.log(error.responseText);
            $('.error-text').text(error.responseText);
            $('.error').show();
        },
        success: () => document.location.reload(true),
    });
}

$('.usernameInput, .passwordInput').keypress((e) => {
	if (e.keyCode == 13) login();
});
