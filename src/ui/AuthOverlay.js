// src/ui/AuthOverlay.js
export class AuthOverlay {
    constructor(scene) {
      this.scene = scene;
      this.visible = false;
      this.container = null;
      this.loginButton = null;
      this.registerButton = null;
      this.currentForm = null; // 'login' or 'register'
      this.formElements = {};
      this.authStatus = {
        authenticated: false,
        username: null
      };
    }
  
    create() {
      // Create container with dark background
      this.container = this.scene.add.container(0, 0);
      this.container.setDepth(1000);
      
      // Add background overlay
      const bg = this.scene.add.rectangle(
        0, 0, 
        this.scene.cameras.main.width, 
        this.scene.cameras.main.height,
        0x000000, 0.7
      );
      bg.setOrigin(0, 0);
      this.container.add(bg);
      
      // Create auth panel
      const panelWidth = 400;
      const panelHeight = 450;
      const panelX = (this.scene.cameras.main.width - panelWidth) / 2;
      const panelY = (this.scene.cameras.main.height - panelHeight) / 2;
      
      const panel = this.scene.add.rectangle(
        panelX, panelY, 
        panelWidth, panelHeight, 
        0x222222, 1
      );
      panel.setOrigin(0, 0);
      panel.setStrokeStyle(2, 0x444444);
      this.container.add(panel);
      
      // Title
      const titleText = this.scene.add.text(
        panelX + panelWidth/2, 
        panelY + 30, 
        'Dungeon Dash Royale', 
        { fontSize: '24px', fill: '#ffffff', fontStyle: 'bold' }
      ).setOrigin(0.5);
      this.container.add(titleText);
      
      // Subtitle
      const subtitleText = this.scene.add.text(
        panelX + panelWidth/2, 
        panelY + 65, 
        'Account Login', 
        { fontSize: '18px', fill: '#aaaaaa' }
      ).setOrigin(0.5);
      this.container.add(subtitleText);
      
      // Tabs
      this.loginButton = this.scene.add.text(
        panelX + panelWidth/4, 
        panelY + 110, 
        'Login', 
        { fontSize: '16px', fill: '#ffffff' }
      ).setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.showLoginForm());
      
      this.registerButton = this.scene.add.text(
        panelX + panelWidth*3/4, 
        panelY + 110, 
        'Register', 
        { fontSize: '16px', fill: '#888888' }
      ).setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.showRegisterForm());
      
      this.container.add([this.loginButton, this.registerButton]);
      
      // Form container
      const formContainer = this.scene.add.container(
        panelX + panelWidth/2, 
        panelY + 180
      );
      this.container.add(formContainer);
      
      // Initialize the login form by default
      this.showLoginForm();
      
      // Hide by default
      this.container.setVisible(false);
      this.visible = false;
    }
  
    createLoginForm() {
      // Clear existing form elements
      Object.values(this.formElements).forEach(el => el.destroy());
      this.formElements = {};
      
      const panelWidth = 400;
      const panelX = (this.scene.cameras.main.width - panelWidth) / 2;
      const panelY = (this.scene.cameras.main.height - 450) / 2;
      
      // Email field
      this.formElements.emailLabel = this.scene.add.text(
        panelX + 50, 
        panelY + 160, 
        'Email:', 
        { fontSize: '16px', fill: '#aaaaaa' }
      );
      
      this.formElements.emailField = this.scene.add.rectangle(
        panelX + panelWidth/2, 
        panelY + 190, 
        300, 40, 
        0x333333
      ).setOrigin(0.5);
      
      this.formElements.emailText = this.scene.add.text(
        panelX + 60, 
        panelY + 190, 
        '', 
        { fontSize: '16px', fill: '#ffffff' }
      ).setOrigin(0, 0.5);
      
      // Password field
      this.formElements.passwordLabel = this.scene.add.text(
        panelX + 50, 
        panelY + 220, 
        'Password:', 
        { fontSize: '16px', fill: '#aaaaaa' }
      );
      
      this.formElements.passwordField = this.scene.add.rectangle(
        panelX + panelWidth/2, 
        panelY + 250, 
        300, 40, 
        0x333333
      ).setOrigin(0.5);
      
      this.formElements.passwordText = this.scene.add.text(
        panelX + 60, 
        panelY + 250, 
        '••••••••', 
        { fontSize: '16px', fill: '#ffffff' }
      ).setOrigin(0, 0.5);
      
      // Login button
      this.formElements.loginButton = this.scene.add.rectangle(
        panelX + panelWidth/2, 
        panelY + 310, 
        200, 50, 
        0x4477aa
      ).setOrigin(0.5);
      
      this.formElements.loginButtonText = this.scene.add.text(
        panelX + panelWidth/2, 
        panelY + 310, 
        'Login', 
        { fontSize: '18px', fill: '#ffffff', fontStyle: 'bold' }
      ).setOrigin(0.5);
      
      // Make login button interactive
      this.formElements.loginButton.setInteractive({ useHandCursor: true })
        .on('pointerover', () => this.formElements.loginButton.setFillStyle(0x5588bb))
        .on('pointerout', () => this.formElements.loginButton.setFillStyle(0x4477aa))
        .on('pointerdown', () => this.handleLogin());
      
      // Guest login link
      this.formElements.guestLink = this.scene.add.text(
        panelX + panelWidth/2, 
        panelY + 370, 
        'Continue as Guest', 
        { fontSize: '16px', fill: '#aaaaaa', fontStyle: 'italic' }
      ).setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => this.formElements.guestLink.setFill('#ffffff'))
      .on('pointerout', () => this.formElements.guestLink.setFill('#aaaaaa'))
      .on('pointerdown', () => this.continueAsGuest());
      
      // Error message (initially hidden)
      this.formElements.errorMessage = this.scene.add.text(
        panelX + panelWidth/2, 
        panelY + 410, 
        '', 
        { fontSize: '14px', fill: '#ff6666' }
      ).setOrigin(0.5).setVisible(false);
      
      // Add all elements to the container
      this.container.add(Object.values(this.formElements));
      
      // Since we can't really input text in Phaser easily without plugins,
      // simulate that we have username/password for demo
      this.formElements.emailText.setText('player@example.com');
      
      // Interactive demo elements (in a real implementation, you'd use proper input fields)
      this.formElements.emailField.setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
          // In a real implementation, you would show a keyboard input here
          console.log('Email field clicked');
        });
      
      this.formElements.passwordField.setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
          // In a real implementation, you would show a keyboard input here
          console.log('Password field clicked');
        });
    }
  
    createRegisterForm() {
      // Clear existing form elements
      Object.values(this.formElements).forEach(el => el.destroy());
      this.formElements = {};
      
      const panelWidth = 400;
      const panelX = (this.scene.cameras.main.width - panelWidth) / 2;
      const panelY = (this.scene.cameras.main.height - 450) / 2;
      
      // Username field
      this.formElements.usernameLabel = this.scene.add.text(
        panelX + 50, 
        panelY + 150, 
        'Username:', 
        { fontSize: '16px', fill: '#aaaaaa' }
      );
      
      this.formElements.usernameField = this.scene.add.rectangle(
        panelX + panelWidth/2, 
        panelY + 175, 
        300, 40, 
        0x333333
      ).setOrigin(0.5);
      
      this.formElements.usernameText = this.scene.add.text(
        panelX + 60, 
        panelY + 175, 
        '', 
        { fontSize: '16px', fill: '#ffffff' }
      ).setOrigin(0, 0.5);
      
      // Email field
      this.formElements.emailLabel = this.scene.add.text(
        panelX + 50, 
        panelY + 205, 
        'Email:', 
        { fontSize: '16px', fill: '#aaaaaa' }
      );
      
      this.formElements.emailField = this.scene.add.rectangle(
        panelX + panelWidth/2, 
        panelY + 230, 
        300, 40, 
        0x333333
      ).setOrigin(0.5);
      
      this.formElements.emailText = this.scene.add.text(
        panelX + 60, 
        panelY + 230, 
        '', 
        { fontSize: '16px', fill: '#ffffff' }
      ).setOrigin(0, 0.5);
      
      // Password field
      this.formElements.passwordLabel = this.scene.add.text(
        panelX + 50, 
        panelY + 260, 
        'Password:', 
        { fontSize: '16px', fill: '#aaaaaa' }
      );
      
      this.formElements.passwordField = this.scene.add.rectangle(
        panelX + panelWidth/2, 
        panelY + 285, 
        300, 40, 
        0x333333
      ).setOrigin(0.5);
      
      this.formElements.passwordText = this.scene.add.text(
        panelX + 60, 
        panelY + 285, 
        '••••••••', 
        { fontSize: '16px', fill: '#ffffff' }
      ).setOrigin(0, 0.5);
      
      // Register button
      this.formElements.registerButton = this.scene.add.rectangle(
        panelX + panelWidth/2, 
        panelY + 335, 
        200, 50, 
        0x44aa77
      ).setOrigin(0.5);
      
      this.formElements.registerButtonText = this.scene.add.text(
        panelX + panelWidth/2, 
        panelY + 335, 
        'Create Account', 
        { fontSize: '18px', fill: '#ffffff', fontStyle: 'bold' }
      ).setOrigin(0.5);
      
      // Make register button interactive
      this.formElements.registerButton.setInteractive({ useHandCursor: true })
        .on('pointerover', () => this.formElements.registerButton.setFillStyle(0x55bb88))
        .on('pointerout', () => this.formElements.registerButton.setFillStyle(0x44aa77))
        .on('pointerdown', () => this.handleRegister());
      
      // Guest login link
      this.formElements.guestLink = this.scene.add.text(
        panelX + panelWidth/2, 
        panelY + 385, 
        'Continue as Guest', 
        { fontSize: '16px', fill: '#aaaaaa', fontStyle: 'italic' }
      ).setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => this.formElements.guestLink.setFill('#ffffff'))
      .on('pointerout', () => this.formElements.guestLink.setFill('#aaaaaa'))
      .on('pointerdown', () => this.continueAsGuest());
      
      // Error message (initially hidden)
      this.formElements.errorMessage = this.scene.add.text(
        panelX + panelWidth/2, 
        panelY + 425, 
        '', 
        { fontSize: '14px', fill: '#ff6666' }
      ).setOrigin(0.5).setVisible(false);
      
      // Add all elements to the container
      this.container.add(Object.values(this.formElements));
      
      // Simulate input for demo
      this.formElements.usernameText.setText('newplayer123');
      this.formElements.emailText.setText('newplayer@example.com');
      
      // Interactive demo elements
      this.formElements.usernameField.setInteractive({ useHandCursor: true });
      this.formElements.emailField.setInteractive({ useHandCursor: true });
      this.formElements.passwordField.setInteractive({ useHandCursor: true });
    }
  
    showLoginForm() {
      this.currentForm = 'login';
      
      // Update tab appearance
      this.loginButton.setFill('#ffffff');
      this.registerButton.setFill('#888888');
      
      // Create login form elements
      this.createLoginForm();
    }
  
    showRegisterForm() {
      this.currentForm = 'register';
      
      // Update tab appearance
      this.loginButton.setFill('#888888');
      this.registerButton.setFill('#ffffff');
      
      // Create register form elements
      this.createRegisterForm();
    }
  
    async handleLogin() {
      // In real implementation, you would get the values from input fields
      const email = this.formElements.emailText.text;
      const password = 'password123'; // Simulated for demo
      
      if (!email || !password) {
        this.showError('Please enter email and password');
        return;
      }
      
      // Show loading state
      this.formElements.loginButtonText.setText('Logging in...');
      this.formElements.loginButton.disableInteractive();
      
      try {
        // Call login method from NetworkManager
        const userData = await window.networkManager.login(email, password);
        
        // Login successful
        this.authStatus = {
          authenticated: true,
          username: userData.username || userData.displayName
        };
        
        // Hide auth overlay
        this.hide();
        
        // Notify scene of successful login
        this.scene.events.emit('authComplete', userData);
      } catch (error) {
        console.error('Login error:', error);
        this.showError('Login failed: ' + (error.message || 'Unknown error'));
      } finally {
        // Reset button state
        this.formElements.loginButtonText.setText('Login');
        this.formElements.loginButton.setInteractive({ useHandCursor: true });
      }
    }
  
    async handleRegister() {
      // In real implementation, you would get the values from input fields
      const username = this.formElements.usernameText.text;
      const email = this.formElements.emailText.text;
      const password = 'password123'; // Simulated for demo
      
      if (!username || !email || !password) {
        this.showError('Please fill all required fields');
        return;
      }
      
      // Show loading state
      this.formElements.registerButtonText.setText('Creating...');
      this.formElements.registerButton.disableInteractive();
      
      try {
        // Call register method from NetworkManager
        const userData = await window.networkManager.register(
          username, 
          email, 
          password,
          { displayName: username }
        );
        
        // Registration successful
        this.authStatus = {
          authenticated: true,
          username: userData.username || userData.displayName
        };
        
        // Hide auth overlay
        this.hide();
        
        // Notify scene of successful registration
        this.scene.events.emit('authComplete', userData);
      } catch (error) {
        console.error('Registration error:', error);
        this.showError('Registration failed: ' + (error.message || 'Unknown error'));
      } finally {
        // Reset button state
        this.formElements.registerButtonText.setText('Create Account');
        this.formElements.registerButton.setInteractive({ useHandCursor: true });
      }
    }
  
    continueAsGuest() {
      // Hide auth overlay
      this.hide();
      
      // Notify scene of guest login
      this.scene.events.emit('guestLogin');
    }
  
    showError(message) {
      if (this.formElements.errorMessage) {
        this.formElements.errorMessage.setText(message);
        this.formElements.errorMessage.setVisible(true);
      }
    }
  
    show() {
      if (!this.container) {
        this.create();
      }
      
      this.container.setVisible(true);
      this.visible = true;
    }
  
    hide() {
      if (this.container) {
        this.container.setVisible(false);
      }
      this.visible = false;
    }
  
    isVisible() {
      return this.visible;
    }
  
    isAuthenticated() {
      return this.authStatus.authenticated;
    }
  
    getUserInfo() {
      return this.authStatus;
    }
  }