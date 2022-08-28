$('.noneClick').on('click', event => event.stopPropagation());

$('.dropdown').on('click', event => {
    const windowHeight = window.innerHeight;
    let target = $(event.target);
    for (let i = 0; i < 2; i++) if (!target.hasClass('dropdown')) target = target.parents();
    event.clientY < windowHeight / 2 || windowHeight < 450 ? target.removeClass('dropdown-top') : target.addClass('dropdown-top');
});

function closeDropDown(event) {
    let targetEl = event.currentTarget;
    if (targetEl && targetEl.matches(':focus')) {
        setTimeout(() => targetEl.blur(), 0);
    }
}

function intoDir(folderName) {
    window.parent.postMessage(folderName, '*');
    top.history.pushState(null, null, folderName);
    // window.location = `${folderName}`;
}

function drag(event) {
    let id = event.target.id;
    event.dataTransfer.setData("text", 'dragged element');
}

function drop(event) {
    event.preventDefault();
    console.log(event.dataTransfer);
    console.log(event.dataTransfer.files[0]);
    var data = event.dataTransfer.getData("text");
    console.log(data);
    // event.target.appendChild(document.getElementById(data));
}