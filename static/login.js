// Do stuffs when page loads
$(window).on('load', () => {
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

$('.options a').on('click', e => {
    hideDropDown();
    let language = $(e.target).attr('value');

    // Store the data in localStorage
    localStorage.setItem('language', language);
});

// Show the drop down when user clicked the dropdown button
$('.dropdown').on('click', function () {
    $('.options').toggleClass('show');
    $('.options').toggleClass('blockAnimation');
});

// When the user click anywhere else on the document, hide the dropdown
$(document).click(e => {
    if (!$(e.target).closest('.dropdown, .options').length) {
        hideDropDown();
    }
})

// When user pressed enter key, press the login button
$('.usernameInput, .passwordInput').keypress(e => {
    if (e.keyCode == 13) {
        $('.button').click();
    }
});

function hideDropDown() {
    $('.options').removeClass('show');
    $('.options').removeClass('blockAnimation');
}