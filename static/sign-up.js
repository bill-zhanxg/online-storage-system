function signup() {
	$.ajax({
		url: '/signup',
		data: { email: $('.email').val(), password: $('.password').val() },
		type: 'POST',
		error: (error) => {
			$('.error-text').text(error.responseText);
			$('.error').show();
		},
		success: () => {
			// TODO: grammar fix
			$('.error-text').text('Please check your email to confirm your account before being able to use it. Don\'t forgot to check your junk folder as well!');
			$('.error').show();
		},
	});
}
