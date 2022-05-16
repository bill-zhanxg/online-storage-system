// Send POST request when user click the login button
function login() {
    $.post("/auth", { username: $('.usernameInput').val(), password: $('.passwordInput').val() }, function (data) {
        if (!data) document.location.reload(true);
        $('.error').text(data);
    }).fail(function () {
        $('.error').text('There is an error while sending request to the server!');
    });
}

// Show the drop down when user clicked the dropdown button
$('.dropdown').on('click', function () {
    $('.options').toggleClass('show');
});

// When the user click anywhere else on the document, hide the dropdown
$(document).click(e => {
    if ($('.renamePanel').css('display') === 'none' || $(e.target).hasClass('ContextMenu-item')) return;
    if (!($(e.target).parents('.renamePanel').length > 0 || $(e.target).hasClass('renamePanel'))) {
        hideRename();
    }
})

// When user pressed enter key, press the login button
$('.passwordInput .usernameInput').keypress(e => {
    if (e.keyCode == 13) {
        $('.button').click();
    }
});