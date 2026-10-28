tailwind.config = {



            darkMode: 'class',



            theme: {



                extend: {



                    colors: {



                        alagoinhas: {



                            50: '#F4F8FD', 100: '#E8F0FA', 200: '#D3E2F4', 300: '#A9C7E9',



                            400: '#78A9DC', 500: '#3F8BD9', 600: '#2E73BC', 700: '#245C98',



                            800: '#1D4876', 900: '#132F4F'



                        }



                    },



                    fontFamily: {



                        sans: ['Inter', 'sans-serif'],



                        display: ['Sora', 'sans-serif']



                    },



                    keyframes: {



                        float: {



                            '0%, 100%': { transform: 'translateY(0)' },



                            '50%': { transform: 'translateY(-15px)' }



                        }



                    },



                    animation: {



                        float: 'float 9s ease-in-out infinite',



                        spin: 'spin 1s linear infinite'



                    }



                }



            }



        };
