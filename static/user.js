function logout() {
    $.post("/auth/logout", () => document.location.reload(true)).fail(() => {

    });
}

$(".fileitem").on('click', event => {
    let target = $(event.target);
    if (target.closest('.checkitem').length || target.closest('.dropdown').length) return;
    let name = target.find('.foldername').text();
    if (!name.trim()) {
        if (target.hasClass('foldername')) name = target.text();
        else return;
        // MORE CODE REQUIRED HERE
    }
    console.log(name);
    // let name = $(event.target).find('.filename');
    // console.log(name.text());
    // window.location = `${window.location.href}/foldername`;
})