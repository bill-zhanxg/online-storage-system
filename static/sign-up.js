function signup() {
	$.ajax({
		url: '/signup',
		data: { email: $('.email').val(), password: $('.password').val() },
		type: 'POST',
		error: (error) => {
			$('.error-text').html(error.responseText.replaceAll('\n', '<br/>'));
			$('.error').show();
		},
		success: () => {
			$('.error-text').html('Please verify your account via the email received to<br/>activate your account. The email may be in your junk folder!');
			$('.error').show();
		},
	});
}
