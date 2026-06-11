const express = require('express');
const bodyParser = require("body-parser");
const {engine} = require('express-handlebars');
const app = express();
const session = require('express-session');
const flash = require('connect-flash');
const mongoose = require('mongoose');
require("./models/Usuario")
const Usuario = mongoose.model("Usuario")


// Configurações
    // Sessão
        app.use(session({
            secret: "crud",
            resave: true,
            saveUninitialized: true
        }));

        app.use(flash())
    // Midleware
        app.use((req, res, next) => {
            res.locals.success_msg = req.flash("success_msg")
            res.locals.error_msg = req.flash("error_msg")
            res.locals.error = req.flash("error")
            
            if (req.user) {
                res.locals.user = req.user.toObject()
            } else {
                res.locals.user = null
            }
            next()
        });
    // Body Parser
        app.use(bodyParser.urlencoded({extended: true}));
        app.use(bodyParser.json());

    // Handlebars
        app.engine('handlebars', engine({
            defaultLayout: 'main',
            helpers: {
                formatDate: function(date) {
                    if (!date) return ""
                    return new Date(date).toLocaleDateString("pt-BR")
                },
                formatSexo: function(sexo) {
                    if(sexo == 1){
                        return "Feminino"
                    } else if(sexo == 0) {
                        return "Masculino"
                    }
                    if(!sexo) return ""
                },
                sexo_selecionado: function (a, b) {
                    return String(a) === String(b)
                },                
            }
            }));
        app.set('view engine', 'handlebars');
        app.set("views", "./views");
        app.use(express.static("public"));
        
    //Mongoose
        mongoose.Promise = global.Promise;
        mongoose.connect("mongodb://localhost/crud").then(() => {
            console.log("Conctado ao banco")
        }).catch((erro) => {
            console.log(erro)
        })

    
// Funções Auxiliares

    function validarDados(nome, email, dataNasc, sexo){
        console.log("entrou na funcao")
        var erros = [];
        const dataAntes = new Date('01-01-1908')
        const dataDepois = new Date()
        const data = new Date(dataNasc)

        if(!nome){
            erros.push({texto: "Preencha seu nome"})
        } else if(nome.length >= 50 || nome.length < 5){
            erros.push({texto: "O nome deve ter entre 5 e 50 caracteres"})
        }
        if(!email){
            console.log("no email")
            erros.push({texto:"Preencha o email"})
        }

        if(!dataNasc){
            erros.push({texto:"Preencha a data de nascimento"})
        } 
        else if(isNaN(data.getTime())){
            erros.push({texto:"Data inválida"})
        }
        else if(data > dataDepois){
            erros.push({texto:"Coloque uma data de nascimento antes da data de hoje, voce não é um viajante no tempo"})
        } 
        else if(data < dataAntes){
            erros.push({texto:"Coloque uma data de nascimento em que é plausível você estar vivo"})
        }


        if(!sexo){
            erros.push({texto:"Selecione seu gênero"})
        }
        return erros
    }

    function parseDate(dateString) {
        if (!dateString) return null

        const [ano, mes, dia] = dateString.split("-")
        return new Date(ano, mes - 1, dia, 12)
    }
    
// Rotas
    app.get('/', (req, res) => {
        Usuario.find().sort({dataNasc: "desc"}).lean().then((usuarios) => {
            res.render("index", {usuarios: usuarios})
        }).catch((e) => {
            req.flash("error_msg", "Erro ao carregar os usuarios")
        })
    })

    app.get("/cadastrar", (req, res) => {
        res.render("cadastro")
    })

    app.post("/novoUsuario", (req, res) => {
        const nome = req.body.nome
        const email = req.body.email
        const data = req.body.dataNasc
        const sexo = req.body.sexo

        erros = validarDados(nome, email, data, sexo)
        if(erros.length > 0){
            return res.render("cadastro", {
                erros: erros, 
                nome: nome, 
                email: email, 
                dataNasc: data,
                sexo: sexo
            })
        } else {
            Usuario.findOne({email: req.body.email}).then((usuario) => {
                if(usuario){
                    req.flash("error_msg", "Já existe uma conta com esse email")
                    return res.render("cadastro", {
                        error_msg: ["Já existe uma conta com esse email"], 
                        nome: nome, 
                        email: email, 
                        dataNasc: data,
                        sexo: sexo
                    })
                    
                } else {
                    req.flash("success_msg", "Usuario salvo com sucesso!")
                    const novoUsuario = {
                        nome: req.body.nome,
                        email: req.body.email,
                        dataNasc: parseDate(req.body.dataNasc),
                        sexo: Number(req.body.sexo)
                    }

                    new Usuario(novoUsuario).save().then(() => {
                        res.redirect("/")
                    }).catch((erro) => {
                        req.flash("error_msg", "Erro ao salvar Usuario!")
                        res.redirect('/cadastrar')
                    })
                }
                        
            })
        
        }

    })

        
    app.get('/edit/:id', (req, res) => {
        Usuario.findOne({_id: req.params.id}).lean().then((usuario) => {

            const dataFormatada = usuario.dataNasc
                ? usuario.dataNasc.toISOString().split("T")[0]
                : ""

            res.render("editusuario", {
                id: usuario._id,
                nome: usuario.nome,
                email: usuario.email,
                dataNasc: dataFormatada,
                sexo: usuario.sexo
            })

        }).catch((erro) => {
            req.flash("error_msg", "Usuario não existe")
            res.redirect("/")
        })
    });

    app.post("/edit", async (req, res) => {
        try {
            const usuario = await Usuario.findOne({_id: req.body.id})

            if (!usuario) {
                req.flash("error_msg", "Usuário não encontrado")
                return res.redirect("/")
            }

            const { nome, email, dataNasc, sexo } = req.body

            const erros = validarDados(nome, email, dataNasc, sexo)

            if (erros.length > 0) {
                return res.render("editusuario", {
                    id: usuario._id,
                    erros,
                    nome,
                    email,
                    dataNasc,
                    sexo
                })
            }

            usuario.nome = nome
            usuario.email = email
            usuario.dataNasc = parseDate(dataNasc)
            usuario.sexo = Number(sexo)

            await usuario.save()

            req.flash("success_msg", "Usuário editado com sucesso!")
            return res.redirect("/")

        } catch (erro) {
            console.log(erro)
            req.flash("error_msg", "Erro ao editar usuário")
            return res.redirect("/")
        }
    })
    
    app.post('/deletar', (req, res) => {
        Usuario.deleteOne({_id: req.body.id_post_delete}).then(() => {
            req.flash("success_msg", "Usuario deletado com sucesso!")
            res.redirect('/')
        }).catch(function(erro){
            req.flash("error_msg", "Erro: " + erro)
            res.redirect('/')
        });
    });



// Outros
const PORT = 8081
app.listen(PORT, () => {
    console.log("Servidando rodando! ")
})