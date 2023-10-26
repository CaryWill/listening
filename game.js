if ("undefined" === typeof lt) var lt = {};
lt.game = {};
lt.game.GameMode = { RANDOM: "random", CUSTOM: "custom", KARAOKE: "karaoke" };
lt.game.GameLevel = {
  BEGINNER: "beginner",
  INTERMEDIATE: "intermediate",
  ADVANCED: "advanced",
  EXPERT: "expert",
};
lt.game.GameLevel.names = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
  expert: "Expert",
};
lt.game.InputMode = { WRITE: "write", CHOICE: "choice" };
lt.game.InputMode.names = { all: "All", write: "Write", choice: "Choice" };
lt.game.ModeHash = {
  b7: { mode: lt.game.GameMode.RANDOM, level: lt.game.GameLevel.BEGINNER },
  ib: { mode: lt.game.GameMode.RANDOM, level: lt.game.GameLevel.INTERMEDIATE },
  a7: { mode: lt.game.GameMode.RANDOM, level: lt.game.GameLevel.ADVANCED },
  e5: { mode: lt.game.GameMode.RANDOM, level: lt.game.GameLevel.EXPERT },
  k6: { mode: lt.game.GameMode.KARAOKE },
};
lt.game.GameView = {
  GAME_MODE: "game-mode",
  GAME_START: "game-start",
  GAME_PLAY: "game-play",
  GAME_SUMMARY: "game-summary",
  GAME_HIGHSCORES: "game-highscores",
  GAME_SIGNUP: "game-signup",
  GAME_PREMIUM: "game-premium",
};
lt.game.lyrics_id = null;
lt.game.settings = null;
lt.game.setup = function (a) {
  lt.game.page = new lt.game.GamePage(a);
  lt.game.loadGameSettings();
};
lt.game.loadGameSettings = function () {
  $.ajax({
    url: "/game_settings.json?rev\x3d2.3.2",
    dataType: "json",
    success: function (a, b, c) {
      lt.game.settings = a;
      lt.game.page.updateModeDesc();
    },
    error: function (a, b, c) {
      console.log("Unable to load game settings.");
    },
  });
};
lt.game.GamePage = function (a) {
  this.lyrics = lt.Lyrics.LRCParser.parse(Base64.decode(a.text_lines, !0));
  $.extend(this.lyrics, {
    id: a.id,
    title: a.title,
    artist: a.artist,
    lang: a.lang,
    start: a.start,
    end: a.end,
    offset: a.offset,
    videoId: a.yt_video_id,
  });
  this.videoPlayer = new VideoPlayer("video-player", {
    videoId: this.lyrics.videoId,
    startTime: a.start,
    endTime: a.end,
  });
  this.customExercise = this.exercise = null;
  this.inputPref = this.readInputPref();
  this.$root = $("#game-area");
  this.modeView = new lt.game.GameModeView(this);
  this.startView = new lt.game.GameStartView(this);
  this.highscoresView = new lt.game.GameHighscoresView(this);
  this.playView = new lt.game.GamePlayView(this, this.lyrics);
  this.summaryView = new lt.game.GameSummaryView(this);
  this.signUpView = new lt.game.GameSignUpView(this);
  this.premiumView = new lt.game.GamePremiumView(this);
  this.initShareBar();
  this.host = this.parseLocationHash();
  var b = this;
  $(window).load(function () {
    b.playView.checkLayout();
  });
  this.host && this.host.mode
    ? this.host.mode === lt.game.GameMode.CUSTOM
      ? this.loadExercise(this.host.exerciseId)
      : this.resetExercise(this.host.mode, {
          level: this.host.level,
          input: this.host.input,
        })
    : this.showView(lt.game.GameView.GAME_MODE);
  if ("published" != a.status) {
    var c = $("#lyrics-info .status-tag"),
      d = function () {
        c.fadeTo(750, 1).delay(250).fadeTo(500, 0, d);
      };
    d();
  }
};
lt.game.GamePage.prototype.showView = function (a, b) {
  var c = this.$root.find(".game-view:visible"),
    d = $("#" + a + "-view");
  0 < c.length &&
    !d.is(c) &&
    c.trigger("before-hide").to(0.25, {
      display: "none",
      opacity: 0,
      ease: Linear.easeNone,
      onComplete: function () {
        c.trigger("hide");
      },
    });
  d.trigger("show").to(0.25, {
    display: "block",
    opacity: 1,
    ease: Linear.easeNone,
    onComplete: function () {
      d.trigger("after-show");
    },
  });
  var e = "/" + a.replace("-", "/");
  gtag("event", "page_view", { path: e });
  this.toggleInfo(a !== lt.game.GameView.GAME_PLAY);
};
lt.game.GamePage.prototype.toggleInfo = function (a) {
  $("#lyrics-info").css("height", a ? "" : 0);
};
lt.game.GamePage.prototype.resetExercise = function (a, b) {
  this.exercise = { mode: a };
  if (a === lt.game.GameMode.RANDOM)
    (this.exercise = {
      mode: a,
      level: b.level,
      input: b.input ? b.input : this.inputPref,
    }),
      this.showView(lt.game.GameView.GAME_START);
  else if (a === lt.game.GameMode.CUSTOM) {
    var c = this.customExercise;
    this.exercise = {
      mode: a,
      id: c.exercise_id,
      title: c.title,
      level: c.level,
      input: "all" === c.input_req ? this.inputPref : c.input_req,
      input_req: c.input_req,
      gaps: c.gaps,
    };
    this.showView(lt.game.GameView.GAME_START);
  } else
    a === lt.game.GameMode.KARAOKE &&
      ((this.exercise = { mode: a }), this.startGame());
  this.updateLocationHash();
};
lt.game.GamePage.prototype.loadExercise = function (a) {
  var b = this;
  this.showMessage("Loading exercise...");
  $.ajax({
    url: "/api/exercise",
    data: { id: a },
    dataType: "json",
    success: function (a, d, e) {
      b.importExercise(a);
    },
    error: function (a, d, e) {
      404 == a.status
        ? lt.showErrorMessage("The exercise not found", null)
        : lt.showErrorMessage("Unable to load the exercise");
      b.showView(lt.game.GameView.GAME_MODE);
    },
    complete: function () {
      b.showMessage();
    },
  });
};
lt.game.GamePage.prototype.importExercise = function (a) {
  a.gaps = new lt.Lyrics.GapIndex(this.lyrics).importData(a.gaps);
  a.gaps.validate(!0);
  this.customExercise = a;
  this.modeView.enablePlayExercise();
  this.resetExercise(lt.game.GameMode.CUSTOM);
};
lt.game.GamePage.prototype.switchInput = function (a) {
  this.exercise.input = this.inputPref = a;
  createCookie("input_pref", a, 365);
  this.updateLocationHash();
};
lt.game.GamePage.prototype.readInputPref = function () {
  return readCookie("input_pref") == lt.game.InputMode.CHOICE
    ? lt.game.InputMode.CHOICE
    : lt.game.InputMode.WRITE;
};
lt.game.GamePage.prototype.togglePractice = function (a) {
  (this.exercise.practice = a) && this.startGame();
};
lt.game.GamePage.prototype.updateModeDesc = function () {
  this.modeView.updateDesc(this.lyrics.countWords());
};
lt.game.GamePage.prototype.startGame = function () {
  this.playView.reset(this.exercise);
  !lt.premiumPromo || readCookie("premium_promo")
    ? lt.user
      ? this.showView(lt.game.GameView.GAME_PLAY)
      : this.showView(lt.game.GameView.GAME_SIGNUP)
    : this.showView(lt.game.GameView.GAME_PREMIUM);
};
lt.game.GamePage.prototype.clearExercise = function () {
  this.exercise = null;
  this.updateLocationHash();
};
lt.game.GamePage.prototype.showMessage = function (a) {
  var b = $("#game-message");
  null == a ? b.toggle(!1) : (b.find("\x3e i").html(a), b.toggle(!0));
};
lt.game.GamePage.prototype.initShareBar = function () {
  var a = this,
    b = $("#share-bar");
  b.find("#share-facebook").on("tap", function () {
    var b = a.shareLink();
    uix.social.share(b, "facebook", {});
  });
  b.find("#share-twitter").on("tap", function () {
    var b = a.shareLink(!0);
    uix.social.share(b, "twitter", {});
  });
  b.find("#share-email").on("tap", function () {
    var b = a.shareLink(),
      d = 'Play "{0}" on LyricsTraining!'.format(
        a.lyrics.artist + " - " + a.lyrics.title
      ),
      b =
        "mailto:?subject\x3d" +
        encodeURIComponent(d) +
        "\x26body\x3d" +
        encodeURIComponent(b);
    $(this).attr("href", b);
  });
};
lt.game.GamePage.prototype.shareLink = function (a) {
  var b =
      "https://" +
      (a
        ? "lyng.me/" + this.lyrics.id
        : "lyricstraining.com" + lt.link("play", this.lyrics)),
    c = this.shareHash();
  "" !== c && (b += (a ? "?" : "#") + c);
  return b;
};
lt.game.GamePage.prototype.shareHash = function () {
  var a = "",
    b,
    c = this.exercise;
  null === c &&
    null !== this.customExercise &&
    (c = {
      mode: lt.game.GameMode.CUSTOM,
      id: this.customExercise.exercise_id,
    });
  null !== c &&
    ((a =
      c.mode !== lt.game.GameMode.CUSTOM
        ? a + this.getModeHash(c.mode, c.level)
        : a + (c.id + "/")),
    (b = c.input));
  b && (a += b === lt.game.InputMode.CHOICE ? "c" : "w");
  b = this.getHostUser();
  b || null == lt.user || (b = lt.user.username);
  b && (a += "!" + encodeURIComponent(b));
  return a;
};
lt.game.GamePage.prototype.getModeHash = function (a, b) {
  for (var c in lt.game.ModeHash)
    if (lt.game.ModeHash[c].mode === a && lt.game.ModeHash[c].level === b)
      return c;
  return null;
};
lt.game.GamePage.prototype.getHostUser = function () {
  return this.host ? this.host.user : null;
};
lt.game.GamePage.prototype.parseLocationHash = function () {
  var a = null,
    b = getLocationHash();
  null != b &&
    (b = RegExp(
      "^(([^/]+)/|" +
        Object.keys(lt.game.ModeHash).join("|") +
        ")?([wc])?(!([a-z][a-z0-9._]+(-[a-z0-9]+)?))?",
      "i"
    ).exec(b)) &&
    ((a = {}),
    b[1] &&
      (b[2]
        ? ((a.mode = lt.game.GameMode.CUSTOM), (a.exerciseId = b[2]))
        : $.extend(a, lt.game.ModeHash[b[1]])),
    3 < b.length &&
      b[3] &&
      ((a.input =
        "c" === b[3] ? lt.game.InputMode.CHOICE : lt.game.InputMode.WRITE),
      (this.inputPref = a.input)),
    5 < b.length && b[5] && (a.user = b[5]));
  return a;
};
lt.game.GamePage.prototype.updateLocationHash = function () {
  location.hash = this.shareHash();
};
lt.game.GamePage.prototype.initAddOptions = function () {
  this.initFavorite();
  this.initPrint();
  this.initEditLyrics();
  this.initNewExercise();
  this.initReportErrorDialog();
};
lt.game.GamePage.prototype.initFavorite = function () {
  var a = this,
    b = $("#toggle-favorite"),
    c = b.find("\x3e .uix-icon"),
    d = b.find("\x3e label");
  b.on("tap", function () {
    if (!lt.user)
      return uix.Dialog.showMessageDialog({
        type: "warn",
        text1: "You must be logged in to add favorites",
        actions: {
          Close: function () {
            $(this).uix("dialog", "close");
          },
        },
      });
    var e = c.hasClass("uix-icon-star-add");
    $.ajax({
      url: "/api/" + (e ? "add_favorite" : "remove_favorite"),
      data: { id: a.lyrics.id },
      success: function (a, b, h) {
        e
          ? (c.removeClass("uix-icon-star-add").addClass("uix-icon-star-rem"),
            d.html("Remove Favorite"))
          : (c.removeClass("uix-icon-star-rem").addClass("uix-icon-star-add"),
            d.html("Add Favorite"));
      },
      error: function (a, b, c) {
        lt.showErrorMessage(
          e
            ? "Unable to add favorite right now"
            : "Unable to remove favorite right now"
        );
      },
      complete: function () {
        b.uix("button", "enable");
      },
    });
    b.uix("button", "disable");
  });
};
lt.game.GamePage.prototype.initPrint = function () {
  var a = this;
  $("#print-lyrics").on("tap", function () {
    window.open(lt.link("print", { id: a.lyrics.id }), "_blank");
  });
};
lt.game.GamePage.prototype.initBuyOn = function () {
  var a = this,
    b = $("#buy-on"),
    c = $("#buy-on-dropdown"),
    d = c.find(".buy-on-loading"),
    e = function () {
      0 === --f &&
        (0 < c.find(".uix-item:visible").length
          ? d.hide()
          : d
              .addClass("error")
              .html("Unable to find links to buy at this time."));
    },
    f = lt.game.GamePage.prototype.buyOnHandlers.length;
  b.on("toggle", function () {
    if (!b.data("load")) {
      for (var c = f; 0 < c; )
        lt.game.GamePage.prototype.buyOnHandlers[--c](a.lyrics, e);
      b.data("load", 1);
    }
  });
  c.on("tap", ".uix-item", function () {
    window.open($(this).data("link"), "_blank");
  }).on("tap", function () {
    b.uix("button", "toggle");
  });
};
lt.game.GamePage.prototype.buyOnHandlers = [
  function (a, b) {
    var c = $("#buy-on-itunes"),
      d = {
        media: "music",
        entity: "song",
        term: a.artist + " - " + a.title,
        limit: 1,
        at: "1001lZ",
      };
    lt.userCountry && (d.country = lt.userCountry);
    $.ajax({
      url: "https://itunes.apple.com/search",
      type: "GET",
      data: d,
      jsonp: "callback",
      dataType: "jsonp",
      success: function (a) {
        0 < a.results.length &&
          c.data("link", a.results[0].trackViewUrl).show();
      },
      complete: b,
    });
  },
];
lt.game.GamePage.prototype.initEditLyrics = function () {
  var a = this;
  $("#edit-lyrics").on("tap", function () {
    lt.editLyrics(a.lyrics.id);
  });
};
lt.game.GamePage.prototype.initNewExercise = function () {
  var a = this;
  $("#new-exercise, .bt-new-exercise").on("tap", function () {
    lt.open("edit_exercise", { ly: a.lyrics.id }, "_blank");
  });
};
lt.game.GamePage.prototype.initReportErrorDialog = function () {
  var a = new lt.game.ReportErrorDialog(this);
  $("#report-error").on("tap", function () {
    a.open();
  });
};
lt.game.GameModeView = function (a) {
  this.page = a;
  this.$root = $("#game-mode-view");
  uix.active(
    this.$root.find(".bt-mode").on("tap", function () {
      a.resetExercise(lt.game.GameMode.RANDOM, {
        level: $(this).data("level"),
      });
    })
  );
  this.$root.find(".bt-karaoke").on("tap", function () {
    a.resetExercise(lt.game.GameMode.KARAOKE);
  });
  this.$root.on({
    show: function () {
      a.clearExercise();
    },
  });
};
lt.game.GameModeView.prototype.enablePlayExercise = function () {
  var a = this.page;
  this.$root
    .find(".bt-play-exercise")
    .on("tap", function () {
      a.resetExercise(lt.game.GameMode.CUSTOM);
    })
    .show()
    .siblings()
    .remove();
};
lt.game.GameModeView.prototype.updateDesc = function (a) {
  var b, c, d;
  b = this.$root.find(".mode-beginner");
  d = lt.game.settings.beginner.gapsRate;
  c = Math.round(a * d);
  b.find("\x3e i").html(
    "Fill {0} random words of {1} ({2}%)".format(c, a, 100 * d)
  );
  b = this.$root.find(".mode-intermediate");
  d = lt.game.settings.intermediate.gapsRate;
  c = Math.round(a * d);
  b.find("\x3e i").html(
    "Fill {0} random words of {1} ({2}%)".format(c, a, 100 * d)
  );
  b = this.$root.find(".mode-advanced");
  d = lt.game.settings.advanced.gapsRate;
  c = Math.round(a * d);
  b.find("\x3e i").html(
    "Fill {0} random words of {1} ({2}%)".format(c, a, 100 * d)
  );
  b = this.$root.find(".mode-expert");
  d = lt.game.settings.expert.gapsRate;
  c = Math.round(a * d);
  b.find("\x3e i").html(
    "Fill all the words ({0}), are you crazy?".format(c, a, 100 * d)
  );
};
lt.game.GameStartView = function (a) {
  this.page = a;
  this.$root = $("#game-start-view");
  var b = this,
    c = this.$root.find(".input-mode \x3e button").on("tap", function () {
      var b = $(this);
      b.siblings().removeClass("uix-active");
      a.switchInput(b.addClass("uix-active").data("mode"));
    }),
    d = this.$root.find(".bt-practice").on("tap", function () {
      a.togglePractice($(this).hasClass("uix-active"));
    });
  this.$root.find(".play-box").on("tap", function (b) {
    a.startGame();
  });
  this.$root.find(".bt-back").on("tap", function () {
    a.showView(lt.game.GameView.GAME_MODE);
  });
  this.$root.find(".bt-highscores").on("tap", function () {
    a.showView(lt.game.GameView.GAME_HIGHSCORES);
  });
  this.$root.on({
    show: function () {
      var e = "";
      a.exercise.mode === lt.game.GameMode.RANDOM
        ? (e += "{0} Level".format(lt.game.GameLevel.names[a.exercise.level]))
        : a.exercise.mode === lt.game.GameMode.CUSTOM &&
          (e +=
            "\x3ci\x3eCustomized Exercise\x26nbsp;/\x3c/i\x3e\x3cb\x3e" +
            a.exercise.title +
            "\x3c/b\x3e");
      b.$root.find(".header \x3e .title").html(e);
      c.uix("button", "enable")
        .removeClass("uix-active")
        .filter(
          a.exercise.input === lt.game.InputMode.CHOICE ? ".choice" : ".write"
        )
        .addClass("uix-active");
      a.exercise.mode === lt.game.GameMode.CUSTOM &&
        "all" !== a.exercise.input_req &&
        c
          .filter(":not(." + a.exercise.input_req + ")")
          .uix("button", "disable");
      a.exercise.practice
        ? d.addClass("uix-active")
        : d.removeClass("uix-active");
      a.exercise.input === lt.game.InputMode.CHOICE
        ? $("#new-mode").hide()
        : $("#new-mode")
            .show()
            .from(0.6, { top: "200%", opacity: 0, ease: Bounce.easeOut });
    },
  });
};
lt.game.GameHighscoresView = function (a) {
  this.page = a;
  this.$root = $("#game-highscores-view");
  this.highscores = new lt.game.HighscoresSubview(
    a,
    this.$root.find("#highscores-view")
  );
  this.$root.find(".bt-start").on("tap", function () {
    a.startGame();
  });
  this.$root.find(".bt-back").on("tap", function () {
    a.showView(lt.game.GameView.GAME_START, !0);
  });
  var b = this;
  this.$root.on({
    show: function () {
      b.highscores.reset();
      b.highscores.show();
    },
  });
};
lt.game.GameSummaryView = function (a) {
  this.page = a;
  this.$root = $("#game-summary-view");
  this.$bar = this.$root.find("\x3e div.summary-bar");
  this.highscores = new lt.game.HighscoresSubview(
    this.page,
    this.$root.find("#highscores-view")
  );
  var b = this;
  this.$root.on("show", function () {
    b.highscores.reset();
    b.highscores.show();
  });
  this.$root.find(".bt-continue").on("tap", function () {
    a.playView.exit(!0);
  });
  this.$root.find(".bt-play-again").on("tap", function () {
    a.playView.reset();
    a.showView(lt.game.GameView.GAME_PLAY);
  });
};
lt.game.GameSummaryView.prototype.fillUp = function (a) {
  this.$bar.find("b.score").html(a.score);
  this.$bar.find("b.hits").html(a.hits);
  this.$bar.find("b.fails").html(a.skips + a.fails);
  this.$bar.find("b.progress").html(parseInt(100 * a.progress) + "%");
};
lt.game.HighscoresSubview = function (a, b) {
  this.page = a;
  this.$root = b;
  this.$filter = this.$root.find(".filter \x3e label");
  this.$lists = this.$root.find(".score-list");
  var c = this;
  this.$filter.each(function (a) {
    uix.active(
      $(this).on("tap", function () {
        c.show(a);
      })
    );
  });
};
lt.game.HighscoresSubview.prototype.reset = function () {
  var a = "";
  this.page.exercise.mode === lt.game.GameMode.RANDOM
    ? (a +=
        "\x3ci\x3e{0} Level\x3c/i\x3e".format(
          lt.game.GameLevel.names[this.page.exercise.level]
        ) + "\x3cb\x3eHighscores\x3c/b\x3e")
    : this.page.exercise.mode === lt.game.GameMode.CUSTOM &&
      (a +=
        "\x3ci\x3eCustomized Exercise\x26nbsp;/\x26nbsp;Highscores\x3c/i\x3e\x3cb\x3e" +
        this.page.exercise.title +
        "\x3c/b\x3e");
  this.$root.find(".header \x3e .title").html(a);
  this.$lists.data("loaded", !1).find("ul").empty();
  null != lt.user && this.$filter.parent().show();
};
lt.game.HighscoresSubview.prototype.show = function (a, b) {
  void 0 === a &&
    (a = null != lt.user && null != this.page.getHostUser() ? 2 : 0);
  var c = this.$lists.hide().eq(a);
  if (1 != a || lt.user.country)
    b && c.data("loaded", !1), c.data("loaded") || this.load(c, a);
  c.show();
  this.$filter.removeClass("uix-active").eq(a).addClass("uix-active");
};
lt.game.HighscoresSubview.prototype.load = function (a, b) {
  var c = this,
    d = {
      id: this.page.lyrics.id,
      mode: this.page.exercise.mode,
      level: this.page.exercise.level,
      input: this.page.exercise.input,
      num: 99,
    };
  this.page.exercise.id && (d.exercise_id = this.page.exercise.id);
  1 === b
    ? (d.country = lt.user.country)
    : 2 === b && ((d.host = this.page.getHostUser()), (d.friends = 1));
  var e = a.find(".message").html("Loading...").show();
  a.find("ul").empty();
  $.ajax({
    url: "/api/highscores",
    data: d,
    type: "POST",
    dataType: "json",
    success: function (f, l, h) {
      c.update(a, f);
      a.data("loaded", !0);
      2 === b && (!d.host || d.host === lt.user.username) && 1 >= f.length
        ? ((f = c.page.shareLink(!0)),
          e.html(
            "Share this link with your friends to challenge for the best score:\x3cbr/\x3e\x3ca href\x3d'" +
              f +
              "'\x3e" +
              f +
              "\x3c/a\x3e"
          ))
        : 0 < f.length
        ? e.hide()
        : e.html("No scores found.");
    },
    error: function (a, b, c) {
      e.html("Unable to load highscores.");
    },
  });
};
lt.game.HighscoresSubview.prototype.update = function (a, b) {
  for (var c = a.find("ul"), d, e = 0, f; e < b.length; e++)
    (f = 10 > e ? "p" + e : "p9"),
      (d = $("\x3cli\x3e").appendTo(c)),
      lt.user && lt.user.username === b[e].username && d.addClass("highlight"),
      $("\x3cspan\x3e", { class: "pos " + f })
        .html(e + 1)
        .appendTo(d),
      $("\x3cspan\x3e", { class: "photo" })
        .html(
          null != b[e].photo ? "\x3cimg src\x3d'" + b[e].photo + "' /\x3e" : ""
        )
        .appendTo(d),
      $("\x3cspan\x3e", { class: "date" })
        .html(fromDate(b[e].date))
        .appendTo(d),
      $("\x3cspan\x3e", { class: "score" })
        .html("\x3ci\x3e\x26nbsp;points\x3c/i\x3e" + b[e].score)
        .appendTo(d),
      $("\x3cspan\x3e", { class: "user" })
        .append(
          $("\x3cb\x3e", {
            class: "flag large " + b[e].country,
            title: COUNTRY_LIST[b[e].country],
          })
        )
        .append(b[e].username)
        .appendTo(d);
};
lt.game.GamePlayView = function (a) {
  this.page = a;
  this.lyrics = a.lyrics;
  this.videoPlayer = a.videoPlayer;
  this.videoPlayer.setPlayerListener(this);
  this.exercise = null;
  this.writing =
    this.completed =
    this.waitingPlay =
    this.ended =
    this.playing =
      !1;
  this.kbs = {
    soft:
      uix.support.mobile && uix.support.touch && !this.readSoftKeyboardOff(),
  };
  this.kbs.system = !this.kbs.soft;
  this.cursor = this.settings = null;
  this.charCount = 0;
  this.playLine = -1;
  this.life =
    this.progress =
    this.tries =
    this.fails =
    this.skips =
    this.hits =
    this.score =
      0;
  this.bonus = 1;
  this.dropLifeDelay = this.dropLifeTime = this.bonusMod = this.bonusHits = 0;
  this.layoutTimer = this.focusTimer = null;
  this.replayTime = 0;
  this.$root = $("#game-play-view");
  this.$parent = $("#game-block");
  this.$lyricsOverlay = $("#lyrics-overlay");
  this.$focusWarn = $("#focus-warn");
  this.$focusWarn.find(".arrow-ani").arrowAni();
  this.$playVideoWarn = $("#play-video-warn");
  this.$playVideoWarn.find(".arrow-ani").arrowAni();
  this.$dialogs = this.initDialogs();
  this.$pauseMenu = this.initPauseMenu();
  this.$textInput = this.initTextInput();
  this.scoreBar = new lt.game.GamePlayView.ScoreBar(this);
  this.lyricsView = new lt.game.GamePlayView.LyricsView(this);
  this.slotsView = new lt.game.GamePlayView.SlotsView(this);
  this.videoProgressBar = this.initVideoProgressBar();
  this.softKeyboard = null;
  this.helpView = new lt.game.GamePlayView.HelpView(this);
  this.fixes = {
    autoPlay: !1,
    clickToFocus: uix.support.mobile && uix.support.touch,
    takeOutVideo: uix.support.mobile,
  };
  this.fixes.takeOutVideo && this.takeOutVideo();
  var b = this;
  this.$root.on({
    "after-show": function () {
      b.waitingPlay || b.start();
      b.toggleVideo(!0, !0);
    },
    "before-hide": function () {
      b.toggleVideo(!1);
    },
  });
  $(window).resize(function (a) {
    a = b.playing && !b.completed;
    !a ||
      !b.writing ||
      b.kbs.system ||
      (null != b.softKeyboard && b.softKeyboard.visible) ||
      (a = !1);
    a && b.checkLayout(250);
  });
  this.$pauseButton = this.$root.find(".bt-pause").on("tap", function (a) {
    b.pause(!0);
    a.stopPropagation();
    return !1;
  });
  window.replay = () => b.replayLine();
  this.$playBackButton = this.$root.find(".bt-repeat").on("tap", function (a) {
    b.replayLine();
  });
  window.skip = () => b.skipGap();
  this.$skipButton = this.$root.find(".bt-skip").on("tap", function (a) {
    b.skipGap();
  });
  this.$playNextButton = this.$root
    .find(".bt-play-next")
    .on("tap", function (a) {
      b.nextLine();
    });
  this.$helpButton = this.$root.find(".bt-help").on("tap", function () {
    $(this).hasClass("uix-active") ? b.toggleHelp(!0) : b.toggleHelp(!1);
  });
};
lt.game.GamePlayView.BONUS_DIVS = 5;
lt.game.GamePlayView.BONUS_MAX = 8;
lt.game.GamePlayView.RED_LINE = 25;
lt.game.GamePlayView.END_LINE_TIME = 1e3;
lt.game.GamePlayView.EMPTY_LIFE_TIME = 1e3;
lt.game.GamePlayView.REPLAY_BACK_TIME = 1e3;
lt.game.GamePlayView.VIDEO_MIN_HEIGHT = 0;
lt.game.GamePlayView.prototype.reset = function (a) {
  void 0 !== a && (this.exercise = a);
  this.playing = this.ended = this.completed = this.waitingPlay = !1;
  this.settings = this.cursor = null;
  this.charCount = 0;
  this.playLine = -1;
  this.progress = this.score = this.hits = this.skips = this.fails = 0;
  this.life = 100;
  this.bonus = 1;
  this.bonusHits = this.bonusMod = 0;
  this.exercise.mode === lt.game.GameMode.KARAOKE
    ? ((this.completed = !0), this.toggleSlotsView(!1), this.toggleSkip(!1))
    : ((this.settings = lt.game.settings[this.exercise.level]),
      this.exercise.mode === lt.game.GameMode.RANDOM &&
        (this.exercise.gaps =
          1 == this.settings.gapsRate
            ? this.lyrics.allWords()
            : this.lyrics.randomWords(this.settings.gapsRate)),
      (this.cursor = this.exercise.gaps.cursor()),
      this.toggleSlotsView(!1),
      this.exercise.input === lt.game.InputMode.CHOICE
        ? ((this.settings = this.settings["input-choice"]),
          this.slotsView.reset(this.exercise.gaps))
        : (this.settings = this.settings["input-write"]),
      (this.bonusMod =
        lt.game.GamePlayView.BONUS_DIVS * this.settings.bonusDivHits + 1),
      this.toggleSkip(!0));
  this.lyricsView.update(this.lyrics, this.exercise);
  this.updateScoreBar();
  this.fixes.autoPlay ||
    this.videoPlayer.started ||
    ((this.waitingPlay = !0), this.togglePlayVideo(!0));
};
lt.game.GamePlayView.prototype.start = function () {
  this.toggleVideo(!0, !0);
  this.waitingPlay
    ? (this.togglePlayVideo(!1), (this.waitingPlay = !1))
    : this.videoPlayer.restart();
  null != this.exercise.gaps && this.nextGap();
  this.playing = !0;
  this.exercise.input === lt.game.InputMode.WRITE
    ? this.toggleWriting(!0)
    : this.exercise.input === lt.game.InputMode.CHOICE &&
      (this.toggleSlotsView(!0), this.slotsView.start());
  this.checkLayout(0);
  this.countPlayHit();
  var a = this.page.lyrics.id + "#" + this.page.shareHash();
  null != lt.user && (a += "@" + lt.user.user_id);
  gtag("event", "game_start", { tag: a });
};
lt.game.GamePlayView.prototype.restart = function () {
  this.waitingPlay || (this.reset(), this.start());
};
lt.game.GamePlayView.prototype.pause = function (a) {
  a && this.togglePauseMenu(!0);
  this.playing = !1;
  this.videoPlayer.started
    ? this.videoPlayer.pause()
    : this.waitingPlay && this.togglePlayVideo(!1);
  this.toggleVideo(!0, !1);
  this.dropLife("pause");
  this.writing && this.toggleWriting(!1);
  this.checkLayout(0);
};
lt.game.GamePlayView.prototype.resume = function (a) {
  this.waitingPlay || (this.playing = !0);
  this.toggleVideo(!0, !0);
  this.videoPlayer.started
    ? this.videoPlayer.suspended ||
      (void 0 !== a && !a) ||
      this.videoPlayer.play()
    : this.waitingPlay && this.togglePlayVideo(!0);
  this.completed ||
    (this.dropLife(),
    this.exercise.input === lt.game.InputMode.WRITE && this.toggleWriting(!0));
  this.checkLayout(0);
};
lt.game.GamePlayView.prototype.end = function (a) {
  if (this.ended) return !0;
  this.ended = !0;
  a
    ? ((this.score += this.life * this.settings.bonusLifePoints),
      (this.progress = 1))
    : (this.progress = (this.hits + this.skips) / this.exercise.gaps.size);
  this.score = parseInt(this.score);
  this.writing && this.toggleWriting(!1);
  this.gc();
  this.exercise.practice ||
    null == lt.user ||
    ((a = {
      id: this.lyrics.id,
      mode: this.exercise.mode,
      level: this.exercise.level,
      input: this.exercise.input,
      progress: this.progress,
      score: this.score,
      host: this.page.getHostUser(),
    }),
    this.exercise.id && (a.exercise_id = this.exercise.id),
    $.ajax({
      url: "/api/save_game",
      data: a,
      type: "POST",
      dataType: "json",
      error: function (a, c, d) {
        console.log("Unable to save game.");
      },
    }));
  this.page.summaryView.fillUp({
    score: this.score,
    hits: this.hits,
    skips: this.skips,
    fails: this.fails,
    progress: this.progress,
  });
  this.countPlayHit(!0);
  a = this.page.lyrics.id + "#" + this.page.shareHash();
  null != lt.user && (a += "@" + lt.user.user_id);
  gtag("event", "game_end", { tag: a });
};
lt.game.GamePlayView.prototype.showCompleted = function () {
  this.pause();
  if (0 < this.life) {
    var a = this;
    this.scoreBar.emptyLife(this.score, this.life, function () {
      a.showDialog("game-complete");
    });
    this.life = 0;
  } else this.showDialog("game-complete");
};
lt.game.GamePlayView.prototype.giveUp = function () {
  if (!this.waitingPlay) {
    this.ended || this.end();
    do
      this.lyricsView.fillGap(
        this.cursor.line,
        this.cursor.gi,
        this.cursor.text,
        !0
      );
    while (this.cursor.next());
    this.completed = !0;
    this.exercise.input === lt.game.InputMode.CHOICE &&
      (this.slotsView.clear(),
      this.lyricsView.movePointer(),
      this.toggleSlotsView(!1));
    this.toggleSkip(!1);
    this.scoreBar.blinkLife(!1);
    this.resume(!1);
    -1 === this.playLine
      ? this.videoPlayer.play()
      : this.seekLine(this.playLine);
  }
};
lt.game.GamePlayView.prototype.exit = function (a) {
  this.playing = !1;
  this.writing && this.toggleWriting(!1);
  !this.ended || this.exercise.practice || a
    ? this.exercise.mode === lt.game.GameMode.CUSTOM || this.exercise.practice
      ? this.page.showView(lt.game.GameView.GAME_START, !0)
      : this.page.showView(lt.game.GameView.GAME_MODE)
    : this.page.showView(lt.game.GameView.GAME_SUMMARY);
  this.videoPlayer.stop();
};
lt.game.GamePlayView.prototype.countPlayHit = function (a) {
  null != this.hitTimer && clearTimeout(this.hitTimer);
  if (!a) {
    var b = this;
    this.hitTimer = setTimeout(function () {
      $.ajax("/api/count_hit?id\x3d" + b.lyrics.id);
      b.hitTimer = null;
    }, 2e4);
  }
};
lt.game.GamePlayView.prototype.initPauseMenu = function () {
  var a = this,
    b = $("#pause-menu"),
    c = b.find("ul.options");
  c.find("\x3e li.op-resume").on("tap", function () {
    a.resume();
  });
  c.find("\x3e li.op-restart").on("tap", function (b) {
    if ($(this).hasClass("uix-disabled"))
      return b.stopImmediatePropagation(), !1;
    a.restart();
  });
  c.find("\x3e li.op-giveup").on("tap", function (b) {
    if ($(this).hasClass("uix-disabled"))
      return b.stopImmediatePropagation(), !1;
    a.giveUp();
  });
  c.find("\x3e li.op-exit").on("tap", function () {
    a.exit();
  });
  c.find("\x3e li").on("tap", function () {
    a.togglePauseMenu(!1);
  });
  b.find("ul.sets")
    .find("\x3e li.set-keyboard")
    .on({
      tap: function () {
        a.switchKeyboard();
      },
      refresh: function () {
        $(this).toggleClass("uix-active", a.kbs.soft);
      },
    })
    .trigger("refresh");
  return b;
};
lt.game.GamePlayView.prototype.togglePauseMenu = function (a) {
  if (a) {
    this.toggleHelp(!1, !0);
    a = this.$pauseMenu.find(".op-restart");
    var b = this.$pauseMenu.find(".op-giveup");
    this.waitingPlay
      ? (a.addClass("uix-disabled"), b.addClass("uix-disabled"))
      : (a.removeClass("uix-disabled"),
        b.removeClass("uix-disabled").toggle(!this.completed));
    this.$pauseMenu
      .find(".set-keyboard")
      .toggle(this.exercise.input === lt.game.InputMode.WRITE);
    this.$pauseMenu.to(0.25, {
      opacity: 1,
      display: "block",
      ease: Linear.easeNone,
    });
  } else
    this.$pauseMenu.to(0.25, {
      opacity: 0,
      display: "none",
      ease: Linear.easeNone,
    });
};
lt.game.GamePlayView.prototype.toggleHelp = function (a, b) {
  a
    ? (this.pause(), this.helpView.toggle(!0))
    : (this.helpView.toggle(!1),
      b ? this.$helpButton.removeClass("uix-active") : this.resume());
};
lt.game.GamePlayView.prototype.toggleSlotsView = function (a, b) {
  null != this.toggleSlotsTimer &&
    (clearTimeout(this.toggleSlotsTimer), (this.toggleSlotsTimer = null));
  var c = this,
    d = function () {
      a ? c.page.$root.addClass("slots") : c.page.$root.removeClass("slots");
    };
  b ? (this.toggleSlotsTimer = setTimeout(d, 1e3)) : d();
};
lt.game.GamePlayView.prototype.togglePressToContinue = function (a) {
  null != this.focusTimer &&
    (clearTimeout(this.focusTimer), (this.focusTimer = null));
  var b = this;
  a
    ? (this.focusTimer = setTimeout(function () {
        ($(window).is(":focus") && b.$textInput.is(":focus")) ||
          (b.lyricsView.$root.to(0.25, { className: "+\x3dfade" }),
          b.$lyricsOverlay.show(),
          b.$focusWarn
            .to(0.25, { className: "+\x3dshow" })
            .find(".arrow-ani")
            .arrowAni("play"));
      }, 500))
    : (this.lyricsView.$root.to(0.25, { className: "-\x3dfade" }),
      this.$focusWarn
        .to(0.25, {
          className: "-\x3dshow",
          onComplete: function () {
            b.$lyricsOverlay.hide();
          },
        })
        .find(".arrow-ani")
        .arrowAni("stop"));
};
lt.game.GamePlayView.prototype.togglePlayVideo = function (a) {
  if (a)
    this.lyricsView.$root.to(0.25, { className: "+\x3dfade" }),
      this.$lyricsOverlay.show(),
      this.$playVideoWarn
        .to(0.25, { className: "+\x3dshow" })
        .find(".arrow-ani")
        .arrowAni("play");
  else {
    var b = this;
    this.lyricsView.$root.to(0.25, { className: "-\x3dfade" });
    this.$playVideoWarn
      .to(0.25, {
        className: "-\x3dshow",
        onComplete: function () {
          b.$lyricsOverlay.hide();
        },
      })
      .find(".arrow-ani")
      .arrowAni("stop");
  }
};
lt.game.GamePlayView.prototype.initDialogs = function () {
  var a = this.$parent.find(".game-dialog");
  this.initGameOverDialog();
  this.initGameCompleteDialog();
  return a;
};
lt.game.GamePlayView.prototype.initGameOverDialog = function () {
  var a = this,
    b = $("#game-over-dialog");
  b.find(".op-try-again").on("tap", function () {
    a.hideDialog("game-over");
    a.restart();
  });
  b.find(".op-continue").on("tap", function () {
    a.hideDialog("game-over");
    a.continuePlay();
  });
  b.find(".op-exit").on("tap", function () {
    a.hideDialog("game-over");
    a.exit();
  });
  return b;
};
lt.game.GamePlayView.prototype.continuePlay = function () {
  this.scoreBar.blinkLife(!1);
  this.resume(!1);
  this.replayLine();
};
lt.game.GamePlayView.prototype.initGameCompleteDialog = function () {
  var a = this,
    b = $("#game-complete-dialog");
  b.find(".op-replay").on("tap", function () {
    a.hideDialog("game-complete");
    a.resume(!1);
    a.videoPlayer.restart();
  });
  b.find(".op-continue").on("tap", function () {
    a.hideDialog("game-complete");
    a.exit();
  });
  return b;
};
lt.game.GamePlayView.prototype.showDialog = function (a) {
  a = $("#" + a + "-dialog");
  a.is(":visible") ||
    (this.$dialogs.to(0.25, {
      opacity: 0,
      display: "none",
      ease: Linear.easeNone,
    }),
    this.toggleVideo(!0, !1),
    a.to(0.25, { opacity: 1, display: "block", ease: Linear.easeNone }));
};
lt.game.GamePlayView.prototype.hideDialog = function (a) {
  a = $("#" + a + "-dialog");
  a.is(":visible") &&
    (a.to(0.25, { opacity: 0, display: "none", ease: Linear.easeNone }),
    this.toggleVideo(!0, !0));
};
lt.game.GamePlayView.prototype.isDialogVisible = function (a) {
  return $("#" + a + "-dialog").is(":visible");
};
lt.game.GamePlayView.prototype.takeOutVideo = function () {
  var a = $("#video-frame"),
    b = $("#video-frame-out"),
    c = $("#video-player"),
    d = b.find(".preview");
  c.prependTo(b);
  d.clone().appendTo(a);
  b.show();
};
lt.game.GamePlayView.prototype.toggleVideo = function (a, b) {
  if (this.fixes.takeOutVideo) {
    var c = $("#video-frame-out"),
      d = c.find(".preview"),
      e = $("#video-player");
    a ? c.addClass("visible") : c.removeClass("visible");
    b
      ? (e.addClass("active"),
        d.to(0.25, { opacity: 0, display: "none", ease: Linear.easeNone }))
      : d.to(0.25, {
          opacity: 1,
          display: "block",
          ease: Linear.easeNone,
          onComplete: function () {
            e.removeClass("active");
          },
        });
  }
};
lt.game.GamePlayView.prototype.initVideoProgressBar = function () {
  var a = $("#video-progress-bar");
  return { $play: a.find("\x3e b"), $load: a.find("\x3e i") };
};
lt.game.GamePlayView.prototype.initTextInput = function () {
  var a = this;
  $(document.body).on("keydown", function (b) {
    b.altKey &&
      b.ctrlKey &&
      "k" === String.fromCharCode(b.which).toLowerCase() &&
      a.switchKeyboard();
    if (!$(b.target).is("input[type!\x3dbutton],textarea"))
      if (a.playing)
        switch (b.which) {
          case 8:
            a.replayLine();
            b.preventDefault();
            break;
          case 38:
            a.prevLine();
            b.preventDefault();
            break;
          case 40:
            a.nextLine(), b.preventDefault();
        }
      else 8 == b.which && b.preventDefault();
  });
  this.$parent.on({
    "touchend mousedown": function (b) {
      a.writing &&
        a.playing &&
        !a.completed &&
        (a.kbs.system && a.$textInput.focus(),
        a.kbs.soft && a.toggleSoftKeyboard(!0),
        b.preventDefault());
    },
  });
  var b = function () {
    a.writing &&
      a.playing &&
      !a.completed &&
      a.kbs.system &&
      a.togglePressToContinue(!0);
  };
  $(window).on("blur", b);
  return $("#text-input").on({
    keydown: function (b) {
      switch (b.which) {
        case 8:
          a.replayLine();
          break;
        case 9:
          return a.skipGap(), b.preventDefault(), !1;
        case 38:
          a.prevLine();
          break;
        case 40:
          a.nextLine();
      }
    },
    keypress: function (b) {
      a.checkChar(String.fromCharCode(b.which));
      b.preventDefault();
      return !1;
    },
    input: function (b) {
      b = $(this);
      a.checkChar(b.val());
      b.val("");
    },
    focus: function () {
      a.writing && a.playing && !a.completed && a.kbs.system
        ? a.togglePressToContinue(!1)
        : $(this).blur();
    },
    blur: b,
  });
};
lt.game.GamePlayView.prototype.toggleWriting = function (a) {
  a
    ? this.writing ||
      ((this.writing = !0),
      this.kbs.system && this.toggleSystemKeyboard(!0),
      this.kbs.soft && this.toggleSoftKeyboard(!0))
    : this.writing &&
      (this.kbs.system && this.toggleSystemKeyboard(!1),
      this.kbs.soft && this.toggleSoftKeyboard(!1),
      this.togglePressToContinue(!1),
      (this.writing = !1));
};
lt.game.GamePlayView.prototype.toggleSystemKeyboard = function (a) {
  this.writing &&
    (a
      ? (this.$textInput.prop("disabled", !1).show(),
        this.$textInput.is(":focus") ||
          (this.fixes.clickToFocus
            ? this.togglePressToContinue(!0)
            : this.$textInput.focus()))
      : (this.$textInput.blur().prop("disabled", !0).hide(),
        this.togglePressToContinue(!1)));
};
lt.game.GamePlayView.prototype.toggleSoftKeyboard = function (a) {
  if (this.writing)
    if (a) {
      if (null === this.softKeyboard) {
        var b = this;
        this.softKeyboard = new lt.game.SoftKeyboard(this.lyrics.lang, {
          press: function (a) {
            b.checkChar(a);
          },
          hide: function () {
            b.kbs.system
              ? b.switchKeyboard(!1)
              : (b.toggleSoftKeyboard(!1), b.togglePressToContinue(!0));
          },
        });
      } else if (this.softKeyboard.visible) return;
      this.softKeyboard.toggle(!0);
      this.kbs.system || this.togglePressToContinue(!1);
      this.checkLayout();
    } else
      this.softKeyboard.visible &&
        (this.softKeyboard.toggle(!1), this.checkLayout());
};
lt.game.GamePlayView.prototype.switchKeyboard = function (a) {
  void 0 === a && (a = !this.kbs.soft);
  uix.support.mobile &&
    uix.support.touch &&
    this.toggleSystemKeyboard((this.kbs.system = !a));
  this.toggleSoftKeyboard((this.kbs.soft = a));
  a ? eraseCookie("soft_kb_off") : createCookie("soft_kb_off", "1");
  this.$pauseMenu.find("ul.sets \x3e li.set-keyboard").trigger("refresh");
};
lt.game.GamePlayView.prototype.readSoftKeyboardOff = function () {
  return "1" === readCookie("soft_kb_off");
};
lt.game.GamePlayView.prototype.checkLayout = function (a) {
  null != this.layoutTimer &&
    (clearTimeout(this.layoutTimer), (this.layoutTimer = null));
  void 0 === a && (a = 50);
  if (0 < a) {
    var b = this;
    this.layoutTimer = setTimeout(function () {
      b.checkLayout(0);
    }, a);
  } else {
    a = $(document.body);
    var c = $("#page"),
      d = $("#game-frame"),
      e = $("#game-block"),
      f = window.innerHeight,
      l = c.offset().top;
    e.css("height");
    var h,
      p = !1;
    e.css("height", "");
    h = d.offset().top - l;
    d = d.outerHeight();
    if (this.playing && this.writing) {
      if (uix.support.mobile && uix.support.touch && !this.kbs.soft) return;
      null != this.softKeyboard &&
        this.softKeyboard.visible &&
        ((f -= this.softKeyboard.$root.outerHeight()), (p = !0));
      var g = d - f;
      if (0 < g) {
        var m = e.height(),
          n = $("#line-bounds").outerHeight(!0);
        g > n / 2 &&
          ((g -= n),
          0 < g &&
            ((n = $("#ad-top").outerHeight()),
            g > n / 2 &&
              ((h = $("#video-block").height()),
              (g -= n),
              h - g < lt.game.GamePlayView.VIDEO_MIN_HEIGHT &&
                (g = h - lt.game.GamePlayView.VIDEO_MIN_HEIGHT),
              (h = e.offset().top - l))));
        e.height(m - g);
        d -= g;
      }
    } else
      d > f &&
        ((h = e.offset().top - l),
        (d = e.outerHeight()),
        d < f && (d = h + d - (h = h + d - f)));
    this.playing &&
    !this.completed &&
    uix.support.mobile &&
    uix.support.touch &&
    (!this.writing || p)
      ? a.hasClass("game-fix")
        ? c.kill().to(0.25, { top: "-" + h + "px" })
        : (a.css("height", c.outerHeight(!0)),
          a.addClass("game-fix"),
          c
            .kill()
            .fromTo(
              0.25,
              { top: "-" + document.body.scrollTop + "px" },
              { top: "-" + h + "px" }
            ))
      : (a.hasClass("game-fix") &&
          ((e = c.kill().css("top")),
          window.scrollTo(document.body.scrollLeft, -parseInt(e)),
          a.removeClass("game-fix").css("height", ""),
          c.css("top", "")),
        (c = document.body.scrollTop),
        (h < c || h + d - c > f) && a.kill().to(0.25, { scrollTop: h }));
  }
};
lt.game.GamePlayView.prototype.nextGap = function (a) {
  a &&
    (this.hits++,
    this.ended ||
      (this.addLife(this.settings.lifeVarGapHit, !0),
      this.dropLife("delay", this.settings.lifeGapDelay)),
    this.addBonus(this.settings.bonusVarGapHit),
    this.lyricsView.markGap(this.cursor.line, this.cursor.gi, a));
  a = this.cursor.line;
  this.cursor.next();
  this.exercise.input === lt.game.InputMode.WRITE
    ? ((this.cursor.cpos = -1), (this.charCount = 0))
    : this.exercise.input === lt.game.InputMode.CHOICE &&
      this.lyricsView.movePointer(this.cursor.line, this.cursor.gi);
  this.tries = 0;
  -1 === this.cursor.line
    ? ((this.completed = !0),
      this.toggleSkip(!1),
      this.exercise.input === lt.game.InputMode.CHOICE &&
        this.toggleSlotsView(!1, !0),
      this.ended ||
        (this.end(!0),
        this.videoPlayer.state === VideoPlayer.STATE_ENDED &&
          this.showCompleted()))
    : this.exercise.input === lt.game.InputMode.WRITE && this.nextChar();
  if (a !== this.cursor.line && this.videoPlayer.suspended)
    if (
      ((a = this.playLine + 1),
      this.videoPlayer.state === VideoPlayer.STATE_PLAYING)
    ) {
      var b = this.lyrics.findLineProgress(this.videoPlayer.currentTime);
      b.line < a || (b.line === a && 0.5 > b.progress)
        ? this.videoPlayer.play()
        : this.seekLine(a);
    } else this.seekLine(a);
  this.updateScoreBar(["gaps"]);
};
lt.game.GamePlayView.prototype.skipGap = function () {
  !this.playing ||
    this.completed ||
    this.cursor.line !== this.playLine ||
    (!this.ended &&
      !this.exercise.practice &&
      this.life <= this.settings.lifeVarGapSkip) ||
    (this.lyricsView.fillGap(
      this.cursor.line,
      this.cursor.gi,
      this.cursor.text,
      !0
    ),
    this.exercise.input === lt.game.InputMode.CHOICE &&
      this.slotsView.skip(this.cursor.text),
    this.skips++,
    this.ended || this.addLife(this.settings.lifeVarGapSkip, !0),
    this.addBonus(this.settings.bonusVarGapSkip),
    this.seekLine(this.playLine),
    this.nextGap());
};
lt.game.GamePlayView.prototype.checkChar = function (a) {
  if (this.playing && !this.completed) {
    var b = this.cursor.text.charAt(this.cursor.cpos),
      b = lt.Lyrics.normalizeChar(b.toLowerCase());
    a = lt.Lyrics.normalizeChar(a.toLowerCase());
    if (b === a)
      return (
        this.lyricsView.fillGap(
          this.cursor.line,
          this.cursor.gi,
          this.cursor.text.substring(0, this.cursor.cpos + 1)
        ),
        this.charCount++,
        this.addBonus(this.settings.bonusVarCharHit),
        this.ended ||
          (this.addLife(this.settings.lifeVarCharHit),
          this.dropLife("delay", this.settings.lifeCharDelay)),
        this.nextChar(),
        !0
      );
    lt.Lyrics.isAlphaNum(a) &&
      (this.addBonus(this.settings.bonusVarCharFail),
      this.ended || this.addLife(this.settings.lifeVarCharFail),
      this.tries++);
    return !1;
  }
};
lt.game.GamePlayView.prototype.nextChar = function () {
  if (null != this.cursor.text) {
    for (; this.cursor.cpos < this.cursor.text.length - 1; )
      if (lt.Lyrics.isAlphaNum(this.cursor.text.charAt(++this.cursor.cpos))) {
        this.lyricsView.moveCursor(
          this.cursor.line,
          this.cursor.gi,
          this.cursor.cpos
        );
        return;
      }
    if (!this.ended) {
      var a =
        this.settings.charPoints * Math.ceil(this.charCount - this.tries / 2);
      0 < a && this.addScore(a * this.bonus);
    }
    this.nextGap(!0);
  }
};
lt.game.GamePlayView.prototype.checkSlot = function (a, b) {
  if (a === this.cursor.text.toLowerCase()) {
    if (b) {
      this.lyricsView.fillGap(
        this.cursor.line,
        this.cursor.gi,
        this.cursor.text
      );
      if (!this.ended) {
        var c = this.settings.slotPoints;
        0 < this.tries && (c = 3 > this.tries ? c / (2 * this.tries) : 0);
        0 < c && this.addScore(c * this.bonus);
      }
      this.nextGap(!0);
    }
    return !0;
  }
  b &&
    (this.fails++,
    this.tries++,
    this.updateScoreBar("gaps"),
    this.ended ||
      this.addLife(
        this.settings.lifeVarSlotFail *
          (3 <= this.tries ? 2 : this.tries / 2 + 0.5),
        !0
      ),
    this.addBonus(this.settings.bonusVarSlotFail));
  return !1;
};
lt.game.GamePlayView.prototype.isCompleted = function () {
  return null == this.cursor || -1 == this.cursor.line;
};
lt.game.GamePlayView.prototype.addScore = function (a) {
  this.score += a;
  this.scoreBar.setScore(parseInt(this.score));
};
lt.game.GamePlayView.prototype.addBonus = function (a) {
  if ("reset" === a) return this.resetBonus();
  var b = !1;
  "string" === typeof a && (a.endsWith("m") && (b = !0), (a = parseInt(a)));
  this.bonusHits = b ? this.bonusHits + a * this.bonusMod : this.bonusHits + a;
  a = (lt.game.GamePlayView.BONUS_MAX - 1) * this.bonusMod - 1;
  0 > this.bonusHits
    ? (this.bonusHits = 0)
    : this.bonusHits > a && (this.bonusHits = a);
  this.bonus = parseInt((this.bonusHits + 1) / this.bonusMod) + 1;
  this.scoreBar.setBonus(this.bonus, this.bonusHits % this.bonusMod);
};
lt.game.GamePlayView.prototype.resetBonus = function () {
  this.bonus = 1;
  this.bonusHits = 0;
  this.scoreBar.setBonus(this.bonus, this.bonusHits);
};
lt.game.GamePlayView.prototype.addLife = function (a, b) {
  if (0 !== this.life && !this.exercise.practice) {
    var c = this.life;
    this.life += a;
    0 >= this.life ? (this.life = 0) : 100 < this.life && (this.life = 100);
    this.scoreBar.setLife(this.life, b);
    c > lt.game.GamePlayView.RED_LINE &&
    this.life <= lt.game.GamePlayView.RED_LINE
      ? this.scoreBar.blinkLife(!0)
      : c <= lt.game.GamePlayView.RED_LINE &&
        this.life > lt.game.GamePlayView.RED_LINE &&
        this.scoreBar.blinkLife(!1);
    0 === this.life &&
      (this.end(!1), this.pause(), this.showDialog("game-over"));
  }
};
lt.game.GamePlayView.prototype.dropLife = function (a, b) {
  if (!(this.completed && this.ended && this.exercise.practice))
    if ("reset" === a) this.dropLifeTime = this.dropLifeDelay = 0;
    else if (
      this.videoPlayer.suspended &&
      this.videoPlayer.state === VideoPlayer.STATE_PAUSED
    ) {
      var c = new Date().getTime();
      if (0 === this.dropLifeTime) this.dropLifeTime = c;
      else {
        var d = c - this.dropLifeTime;
        0 !== this.dropLifeDelay && (d -= this.dropLifeDelay);
        if (0 < d) {
          var e = -this.computeVar(
            this.settings.lifeVarTime[0],
            this.settings.lifeVarTime[1],
            this.life / 100,
            this.settings.lifeVarTime[2]
          );
          this.addLife((e * d) / 1e3);
          this.dropLifeTime = c;
          this.dropLifeDelay = 0;
        }
      }
      switch (a) {
        case "pause":
          0 !== this.dropLifeDelay &&
            (this.dropLifeDelay -= c - this.dropLifeTime);
          this.dropLifeTime = 0;
          break;
        case "delay":
          (this.dropLifeDelay = b), (this.dropLifeTime = c);
      }
    }
};
lt.game.GamePlayView.prototype.gc = function () {
  lt.user &&
    createCookie(
      "_gsc",
      Base64.encode(
        [
          this.lyrics.id,
          lt.user.username,
          this.exercise.mode,
          this.exercise.level,
          this.exercise.input,
          this.score,
          this.progress,
        ].join("|")
      ),
      2.3148e-4
    );
};
lt.game.GamePlayView.prototype.updateScoreBar = function (a) {
  (null != a && -1 === a.indexOf("score")) ||
    this.scoreBar.setScore(parseInt(this.score));
  if (null == a || -1 !== a.indexOf("gaps"))
    this.scoreBar.setGaps(
      this.hits + this.skips,
      null != this.exercise.gaps ? this.exercise.gaps.size : 0
    ),
      this.scoreBar.setHits(this.hits),
      this.scoreBar.setFails(this.skips + this.fails);
  if (null == a || -1 !== a.indexOf("life"))
    this.scoreBar.setLife(this.life),
      this.life > lt.game.GamePlayView.RED_LINE && this.scoreBar.blinkLife(!1);
  (null != a && -1 === a.indexOf("bonus")) ||
    this.scoreBar.setBonus(this.bonus, this.bonusHits % this.bonusMod);
};
lt.game.GamePlayView.prototype.computeVar = function (a, b, c, d) {
  return (b - a) * Math.pow(c, d) + a;
};
lt.game.GamePlayView.prototype.toggleSkip = function (a) {
  a
    ? (this.$skipButton.show(), this.$playNextButton.hide())
    : (this.$skipButton.hide(), this.$playNextButton.show());
};
lt.game.GamePlayView.prototype.rightAction = function () {
  this.completed ? this.nextLine() : this.skipGap();
};
lt.game.GamePlayView.prototype.replayLine = function () {
  if (this.playing) {
    var a = new Date().getTime();
    if (
      this.replayTime &&
      a - this.replayTime < lt.game.GamePlayView.REPLAY_BACK_TIME
    )
      this.prevLine();
    else {
      if (!this.completed && !this.ended && !this.exercise.practice)
        if (this.life > this.settings.lifeVarRepeat)
          this.addLife(this.settings.lifeVarRepeat, !0),
            this.addBonus(this.settings.bonusVarRepeat);
        else return;
      this.seekLine(0 <= this.playLine ? this.playLine : 0);
    }
    this.replayTime = a;
  }
};
lt.game.GamePlayView.prototype.seekLine = function (a) {
  a = 0 <= a ? this.lyrics.getLineTime(a) : this.lyrics.start || 0;
  null != a && this.videoPlayer.seekTime(a);
};
lt.game.GamePlayView.prototype.prevLine = function () {
  0 <= this.playLine && this.playLine--;
  this.seekLine(this.playLine);
};
lt.game.GamePlayView.prototype.nextLine = function () {
  if (this.playLine < this.lyrics.lines.length - 1) {
    var a = this.playLine + 1;
    if (null == this.cursor || -1 == this.cursor.line || a <= this.cursor.line)
      this.seekLine(a), (this.playLine = a);
  }
};
lt.game.GamePlayView.prototype.onPlayerReady = function () {};
lt.game.GamePlayView.prototype.onPlayerStart = function () {
  this.waitingPlay && this.start();
  this.videoPlayer.setVolume(100);
};
lt.game.GamePlayView.prototype.onPlayerStateChange = function (a, b) {
  a === VideoPlayer.STATE_ENDED &&
    this.ended &&
    this.completed &&
    this.showCompleted();
};
lt.game.GamePlayView.prototype.onPlayerCheck = function (a, b, c, d) {
  if (this.playing) {
    var e = this.lyrics.findLineProgress(b, c);
    if (null != e) {
      var f = 0;
      e.line === this.playLine
        ? (f = e.progress)
        : e.line > this.playLine
        ? this.videoPlayer.seeking
          ? (f = 1)
          : this.completed
          ? ((this.playLine = e.line), (f = e.progress))
          : (e.line <= this.cursor.line
              ? ((this.playLine = e.line), (f = e.progress))
              : ((f = 1),
                this.videoPlayer.suspended ||
                  ((e = this.lyrics.getLineEndTime(this.playLine)),
                  null != e &&
                    b > e + lt.game.GamePlayView.END_LINE_TIME &&
                    (this.videoPlayer.suspend(),
                    this.ended ||
                      this.exercise.practice ||
                      this.dropLife("reset")))),
            this.ended ||
              this.exercise.practice ||
              !this.videoPlayer.suspended ||
              a !== VideoPlayer.STATE_PAUSED ||
              this.dropLife())
        : this.videoPlayer.seeking ||
          ((this.playLine = e.line), (f = e.progress));
      this.lyricsView.playLine(this.playLine, f);
    }
  }
  this.videoProgressBar.$play.width(
    (0 < c ? (100 * (b - (this.lyrics.start || 0))) / c : 0) + "%"
  );
  this.videoProgressBar.$load.width(100 * d + "%");
};
lt.game.GamePlayView.prototype.onPlayerError = function (a) {
  console.log("Player Error: " + a);
};
lt.game.GamePlayView.ScoreBar = function (a) {
  this.parent = a;
  a = $("#game-play-view .score-bar");
  this.$score = a.find(".score b");
  this.$gaps = a.find(".gaps span");
  this.$hits = a.find(".hits span");
  this.$fails = a.find(".fails span");
  this.$lifebar = a.find(".lifebar b");
  this.$bonus = a.find(".bonus b");
  this.$bonusSteps = this.$bonus.closest("div").find("a");
};
lt.game.GamePlayView.ScoreBar.prototype.reset = function () {
  this.setScore(0);
  this.setGaps(0, 0);
  this.setHits(0);
  this.setFails(0);
  this.setBonus(1);
  this.setLife(100);
};
lt.game.GamePlayView.ScoreBar.prototype.setScore = function (a) {
  this.$score.html(a);
};
lt.game.GamePlayView.ScoreBar.prototype.setGaps = function (a, b) {
  this.$gaps.html(a + "/" + b);
};
lt.game.GamePlayView.ScoreBar.prototype.setHits = function (a) {
  this.$hits.html(a);
};
lt.game.GamePlayView.ScoreBar.prototype.setFails = function (a) {
  this.$fails.html(a);
};
lt.game.GamePlayView.ScoreBar.prototype.setBonus = function (a, b) {
  this.$bonus.html(a);
  if (void 0 !== b) {
    var c = b / ((this.parent.bonusMod - 1) / lt.game.GamePlayView.BONUS_DIVS),
      d = c % 1,
      c = parseInt(c);
    this.$bonusSteps.each(function (a) {
      var b = $(this);
      a < c || (a === c && 0 < d)
        ? b.addClass("on").css("opacity", a === c ? d : 1)
        : b.removeClass("on").css("opacity", 1);
    });
  }
};
lt.game.GamePlayView.ScoreBar.prototype.setLife = function (a, b) {
  this.$lifebar.to(b ? 0.6 : 0, {
    width: parseFloat(a.toFixed(2)) + "%",
    ease: Elastic.easeOut,
  });
};
lt.game.GamePlayView.ScoreBar.prototype.emptyLife = function (a, b, c) {
  var d = this,
    e = parseInt(this.$score.text()),
    f = a - e;
  a = {
    width: 0,
    ease: Quad.easeIn,
    onUpdate: function (a) {
      d.setScore(parseInt(e + f * a.progress()));
    },
    onUpdateParams: ["{self}"],
  };
  b = parseInt((b / 100) * lt.game.GamePlayView.EMPTY_LIFE_TIME) / 1e3;
  void 0 !== c && (a.onComplete = c);
  this.$lifebar.to(b, a);
};
lt.game.GamePlayView.ScoreBar.prototype.blinkLife = function (a) {
  TweenMax.killTweensOf(this.$lifebar, { opacity: !0 });
  a
    ? this.$lifebar.fromTo(
        0.6,
        { opacity: 1 },
        { opacity: 0.5, repeat: -1, yoyo: !0 }
      )
    : this.$lifebar.to(0, { opacity: 1 });
};
lt.game.GamePlayView.LyricsView = function (a) {
  this.parent = a;
  this.$root = $("#lyrics-view");
  this.$list = this.$root.find("\x3e ul.lines");
  this.$lines = null;
  this.$lineBounds = $("#line-bounds");
  this.$pointer = null;
  this.lineWidth = 0;
  this.li = -1;
  var b = this,
    c = !1;
  this.$root.on({
    swipe: function (a) {
      a = a.originalEvent.detail;
      "horizontal" === a.orientation &&
        ("right" === a.direction
          ? b.parent.rightAction()
          : b.parent.replayLine());
    },
    dragstart: function (a) {
      "horizontal" === a.originalEvent.detail.orientation && (c = !0);
    },
    dragend: function () {
      c = !1;
    },
    touchmove: function (a) {
      c && a.preventDefault();
    },
  });
};
lt.game.GamePlayView.LyricsView.MASK_CHAR = "\u2022";
lt.game.GamePlayView.LyricsView.MASK_CHAR2 = "\u25cf";
lt.game.GamePlayView.LyricsView.TEXT_MAX_SIZE = 28;
lt.game.GamePlayView.LyricsView.TEXT_MIN_SIZE = 16;
lt.game.GamePlayView.LyricsView.prototype.update = function (a, b) {
  this.$list.empty();
  this.$lines = null;
  this.lineHeight = 56;
  for (
    var c = new lt.Lyrics.Reader(a, b ? b.gaps : null),
      d,
      e,
      f = !0,
      l,
      h = this.$lineBounds.find("\x3e span"),
      p = this.$lineBounds.width();
    (d = c.next()) !== lt.Lyrics.Reader.END;

  ) {
    f && ((l = $("\x3cli\x3e").appendTo(this.$list)), (e = ""), (f = !1));
    if (d === lt.Lyrics.Reader.EOL) {
      l.wrapInner("\x3cdiv\x3e");
      f = !0;
      h.html(e);
      d = lt.game.GamePlayView.LyricsView.TEXT_MAX_SIZE;
      do h.css("font-size", d + "px");
      while (
        h.outerWidth() > p &&
        --d >= lt.game.GamePlayView.LyricsView.TEXT_MIN_SIZE
      );
      d < lt.game.GamePlayView.LyricsView.TEXT_MAX_SIZE &&
        l.css("font-size", d + "px");
    } else if (d === lt.Lyrics.Reader.GAP) {
      d = "";
      if (b.input === lt.game.InputMode.WRITE)
        for (var g = 0, m; g < c.text.length; g++)
          (m = c.text.charAt(g)),
            (d = lt.Lyrics.isAlphaNum(m)
              ? d + lt.game.GamePlayView.LyricsView.MASK_CHAR
              : d + m);
      else
        d +=
          "\x3ca\x3e" +
          lt.game.GamePlayView.LyricsView.MASK_CHAR +
          "\x3c/a\x3e";
      l.append("\x3cb\x3e" + d + "\x3c/b\x3e");
    } else l.append(c.text);
    e += c.text;
  }
  this.$lines = this.$list.find("\x3e li");
  this.resetScroll();
};
lt.game.GamePlayView.LyricsView.prototype.resetScroll = function () {
  this.$list.kill().css("top", this.lineHeight + "px");
  this.li = -1;
};
lt.game.GamePlayView.LyricsView.prototype.scrollTo = function (a) {
  a !== this.li &&
    (this.$list.to(0.1, {
      top: -a * this.lineHeight + "px",
      ease: Quad.easeIn,
    }),
    (this.li = a));
};
lt.game.GamePlayView.LyricsView.prototype.playLine = function (a, b) {
  var c = -1 !== a ? this.$lines.eq(a) : null,
    d = this.$lines.eq(this.li);
  null != c && 0 < c.length
    ? (c.is(d) || (0 < d.length && this.removeLight(d), this.addLight(c)),
      this.updateProgress(c, b))
    : 0 < d.length && this.removeLight(d);
  this.scrollTo(a);
};
lt.game.GamePlayView.LyricsView.prototype.addLight = function (a) {
  a.append(
    a
      .find("\x3e div:first-child")
      .clone()
      .addClass("light")
      .wrapInner("\x3cp\x3e")
  );
};
lt.game.GamePlayView.LyricsView.prototype.removeLight = function (a) {
  a.find("\x3e div.light").remove();
  a.find("\x3e div:first-child").css("clip", "auto");
};
lt.game.GamePlayView.LyricsView.prototype.updateLight = function (a) {
  var b = a.find("\x3e div:first-child");
  a.find("\x3e div.light \x3e p").empty().append(b.clone().contents());
  this.updateProgress(a);
};
lt.game.GamePlayView.LyricsView.prototype.updateProgress = function (a, b) {
  var c = void 0 === b ? a.data("progress") : b;
  null == c && (c = 0);
  var d = a.find("\x3e div:first-child"),
    e = a.find("\x3e div.light"),
    f = e.find("\x3e p");
  if (0 < f.length) {
    var l = f.position(),
      h = f.outerWidth();
    f.outerHeight();
    c = l.left + parseInt(h * c);
    d.css("clip", "rect(0px, auto, auto, " + c + "px)");
    e.css("clip", "rect(0px, " + c + "px, auto, 0px)");
  }
  void 0 !== b && a.data("progress", b);
};
lt.game.GamePlayView.LyricsView.prototype.relayoutPlayLine = function (a) {
  a.find("\x3e div.light").remove();
  this.addLight(a);
  this.updateProgress(a);
};
lt.game.GamePlayView.LyricsView.prototype.fillGap = function (a, b, c, d) {
  a = this.$lines.eq(a);
  b = a.find("div:first-child \x3e b").eq(b);
  var e = b.text();
  e.length > c.length && (c += e.substr(c.length));
  b.html(c);
  d && b.addClass("fail").append("\x3cu\x3e");
  this.updateLight(a);
};
lt.game.GamePlayView.LyricsView.prototype.markGap = function (a, b, c) {
  a = this.$lines.eq(a);
  a.find("div:first-child \x3e b")
    .eq(b)
    .addClass(c ? "hit" : "fail")
    .append("\x3cu\x3e");
  this.updateLight(a);
};
lt.game.GamePlayView.LyricsView.prototype.moveCursor = function (a, b, c) {
  a = this.$lines.eq(a);
  b = a.find("div:first-child \x3e b").eq(b);
  var d = b.text();
  if (0 <= c && c < d.length) {
    var e = $("\x3ci\x3e").append(d.substr(c, 1));
    b.html(d.substring(0, c))
      .append(e)
      .append(d.substring(c + 1));
    this.updateLight(a);
    this.blinkCursor(e);
  }
};
lt.game.GamePlayView.LyricsView.prototype.blinkCursor = function (a) {
  var b = this;
  a.queue(function () {
    b.$list.addClass("c-on");
    $(this).dequeue();
  })
    .delay(500)
    .queue(function () {
      b.$list.removeClass("c-on");
      $(this).dequeue();
    })
    .delay(250)
    .queue(function () {
      b.blinkCursor(a);
      $(this).dequeue();
    });
};
lt.game.GamePlayView.LyricsView.prototype.movePointer = function (a, b) {
  if (null != this.$pointer) {
    var c = this.$pointer,
      d = this.$lines.eq(c._li);
    d.find("div:first-child \x3e b").eq(c._gi).removeClass("p");
    c._li !== a && c._li === this.li && this.updateLight(d);
    c.to(0.2, {
      opacity: 0,
      scale: 2.5,
      ease: Linear.easeNone,
      onComplete: function () {
        c.remove();
      },
    });
    this.$pointer = null;
  }
  if (0 <= a) {
    var d = this.$lines.eq(a),
      e = d.find("div:first-child \x3e b").eq(b);
    e.addClass("p");
    a === this.li && this.updateLight(d);
    var d = this.$list.offset(),
      e = e.find("\x3e a").offset(),
      f = $("\x3cspan class\x3d'pointer'\x3e").appendTo(this.$list);
    f.css({ top: e.top - d.top, left: e.left - d.left })
      .from(0.2, { opacity: 0, scale: 2.5, ease: Linear.easeNone })
      .fromTo(
        1,
        { rotation: 0 },
        { rotation: 360, repeat: -1, ease: Linear.easeNone }
      );
    f._li = a;
    f._gi = b;
    this.$pointer = f;
  }
};
lt.game.GamePlayView.SlotsView = function (a) {
  this.parent = a;
  this.cursor = null;
  this.nextGaps = [];
  this.$root = $("#slots-view");
  this.$slots = this.$root.find("\x3e .slot");
  var b = this;
  this.$slots.on({
    tapstart: function (a) {
      a = $(this);
      console.log("tapstart: " + a[0].className);
      !a.hasClass("press") &&
        a.data("text") &&
        (b.check(a), a.classTo(null, "press", 0));
    },
    tapend: function (a) {
      a = $(this);
      console.log("tapend: " + a[0].className);
      a.hasClass("press") &&
        (b.check(a, !0),
        a.kill(!0).classTo("press", a.data("text") ? null : "empty", 0.5));
    },
    mouseenter: function (a) {
      a = $(this);
      !a.hasClass("hover") && a.data("text") && a.classTo(null, "hover", 0.1);
    },
    mouseleave: function (a) {
      a = $(this);
      a.hasClass("hover") &&
        (a.hasClass("press")
          ? (b.check(a, !0),
            a
              .kill(!0)
              .classTo("press hover", a.data("text") ? null : "empty", 0.5))
          : a.classTo("hover", null, 0.1));
    },
  });
  this.$root.on("touchstart", function (a) {
    a.preventDefault();
  });
};
lt.game.GamePlayView.SlotsView.TWEEN_TIME = 0.2;
lt.game.GamePlayView.SlotsView.MIN_FONT_SIZE = 16;
lt.game.GamePlayView.SlotsView.prototype.reset = function (a) {
  this.cursor = a.cursor();
  this.nextGaps = [];
  this.clear();
};
lt.game.GamePlayView.SlotsView.prototype.start = function () {
  var a = this;
  this.$slots.each(function () {
    var b = $(this);
    a.fill(b) || b.addClass("empty");
  });
};
lt.game.GamePlayView.SlotsView.prototype.fill = function (a) {
  for (var b, c; ; ) {
    b = this.next();
    if (null === b) return !1;
    c = this.find(b);
    if (0 < c.length) this.incr(c);
    else return this.put(a, b), !0;
  }
};
lt.game.GamePlayView.SlotsView.prototype.next = function () {
  if (0 === this.nextGaps.length)
    for (; this.nextGaps.length < this.$slots.length && this.cursor.next(); )
      this.nextGaps.push(this.cursor.text);
  if (0 < this.nextGaps.length) {
    var a = Math.floor(Math.random() * this.nextGaps.length);
    return this.nextGaps.splice(a, 1)[0];
  }
  return null;
};
lt.game.GamePlayView.SlotsView.prototype.put = function (a, b) {
  var c = b.capFirst(),
    d = $("\x3cb\x3e\x3c/b\x3e").css("opacity", 0),
    e = $("\x3ci\x3e" + c + "\x3c/i\x3e").appendTo(d);
  a.prepend(d).data("text", b.toLowerCase());
  for (
    var f = d.width(), l = parseInt(a.css("font-size"));
    e.width() > f && l > lt.game.GamePlayView.SlotsView.MIN_FONT_SIZE;

  )
    d.css("font-size", --l + "px");
  d.html(c).fromTo(
    lt.game.GamePlayView.SlotsView.TWEEN_TIME,
    { opacity: 0, x: "-50%" },
    { opacity: 1, x: "0%", ease: Quad.easeIn }
  );
};
lt.game.GamePlayView.SlotsView.prototype.pop = function (a) {
  var b = a.find("\x3e b:first-child");
  b.to(lt.game.GamePlayView.SlotsView.TWEEN_TIME, {
    opacity: 0,
    scale: 1.8,
    ease: Quad.easeIn,
    onComplete: function () {
      b.remove();
    },
  });
  a.removeData("text");
};
lt.game.GamePlayView.SlotsView.prototype.incr = function (a) {
  a.find("\x3e ol").append("\x3cli\x3e");
};
lt.game.GamePlayView.SlotsView.prototype.find = function (a) {
  a = a.toLowerCase();
  return this.$slots.filter(function () {
    return $(this).data("text") === a;
  });
};
lt.game.GamePlayView.SlotsView.prototype.remove = function (a) {
  var b = a.find("\x3e ol \x3e li:not(.rem)").first();
  0 < b.length
    ? b.addClass("rem").to(lt.game.GamePlayView.SlotsView.TWEEN_TIME, {
        opacity: 0,
        marginRight: "20px",
        ease: Cubic.easeOut,
        onComplete: function () {
          b.remove();
        },
      })
    : (this.pop(a), this.fill(a));
};
lt.game.GamePlayView.SlotsView.prototype.skip = function (a) {
  a = this.find(a);
  this.remove(a);
  a.data("text") || a.kill(!0).classTo("press hover", "empty", 1);
};
lt.game.GamePlayView.SlotsView.prototype.check = function (a, b) {
  this.parent.checkSlot(a.data("text"), b)
    ? (b && this.remove(a), a.removeClass("fail"))
    : (b && this.shake(a), a.addClass("fail"));
};
lt.game.GamePlayView.SlotsView.prototype.shake = function (a) {
  a = a.find("\x3e b:first-child");
  uix.effects.shake(a, { dir: "right", distance: 10, duration: 0.3 });
};
lt.game.GamePlayView.SlotsView.prototype.clear = function (a) {
  void 0 === a && (a = this.$slots);
  a.removeData("text")
    .removeClass("hover press fail empty")
    .find("\x3e b")
    .remove();
  a.find("ol").empty();
};
lt.game.GamePlayView.HelpView = function (a) {
  this.parent = a;
  this.$root = $("#help-view");
  this.$slides = this.$root.find("\x3e .help-slides \x3e p");
  this.visible = !1;
  this.$slides.first().show();
  this.curr = 0;
  var b = this;
  this.$prev = $("#help-nav-prev").on("tap", function () {
    b.prev();
  });
  this.$next = $("#help-nav-next").on("tap", function () {
    b.next();
  });
  this.$dots = this.$root.find(".help-dots");
  for (a = 0; a < this.$slides.length; a++) this.$dots.append("\x3cli\x3e");
  this.$dots = this.$dots.children();
  this.check();
};
lt.game.GamePlayView.HelpView.prototype.prev = function () {
  0 < this.curr &&
    (this.swap(this.$slides.eq(this.curr), this.$slides.eq(--this.curr)),
    this.check());
};
lt.game.GamePlayView.HelpView.prototype.next = function () {
  this.curr < this.$slides.length - 1 &&
    (this.swap(this.$slides.eq(this.curr), this.$slides.eq(++this.curr), !0),
    this.check());
};
lt.game.GamePlayView.HelpView.prototype.swap = function (a, b, c) {
  var d = this.$root.outerWidth();
  a.fromTo(
    0.4,
    { left: 0, opacity: 1, display: "block" },
    { left: c ? -d : d, opacity: 0, display: "none", ease: Quad.easeIn }
  );
  b.fromTo(
    0.4,
    { left: c ? d : -d, opacity: 0, display: "none" },
    { left: 0, opacity: 1, display: "block", ease: Quad.easeIn }
  );
};
lt.game.GamePlayView.HelpView.prototype.check = function () {
  var a = this.$slides.eq(this.curr);
  this.toggleMark(!1);
  a.hasClass("-bl") && this.toggleMark("bl");
  a.hasClass("-br") && this.toggleMark("br");
  0 < this.curr
    ? this.$prev.uix("button", "enable")
    : this.$prev.uix("button", "disable");
  this.curr < this.$slides.length - 1
    ? this.$next.uix("button", "enable")
    : this.$next.uix("button", "disable");
  this.$dots.removeClass("on").eq(this.curr).addClass("on");
};
lt.game.GamePlayView.HelpView.prototype.toggle = function (a) {
  a
    ? (this.$root.to(0.25, {
        opacity: 1,
        display: "block",
        ease: Linear.easeNone,
      }),
      this.check(),
      (this.visible = !0))
    : (this.$root.to(0.25, {
        opacity: 0,
        display: "none",
        ease: Linear.easeNone,
      }),
      this.toggleMark(!1),
      (this.visible = !1));
};
lt.game.GamePlayView.HelpView.prototype.toggleMark = function (a) {
  !1 === a
    ? ((a = this.$root.find(".help-mark")),
      a.to(0.5, { display: "none", opacity: 0, ease: Linear.easeNone }),
      a.find("\x3e .help-circle").kill())
    : ((a = $("#help-mark-" + a).to(0.5, {
        display: "block",
        opacity: 1,
        ease: Linear.easeNone,
      })),
      a.find("\x3e .help-circle").fromTo(
        0.5,
        { opacity: 1 },
        {
          delay: 0.5,
          opacity: 0,
          repeat: -1,
          yoyo: !0,
          ease: Linear.easeNone,
        }
      ));
};
lt.game.GameSignUpView = function (a) {
  this.page = a;
  this.$root = $("#game-signup-view");
  this.$root.find(".bt-signup-create").on("tap", function () {
    lt.open("sign_up");
  });
  this.$root.find(".bt-signup-later").on("tap", function () {
    a.showView(lt.game.GameView.GAME_PLAY);
  });
};
lt.game.GamePremiumView = function (a) {
  this.page = a;
  this.$root = $("#game-premium-view");
  this.$root.find(".bt-premium-get").on("tap", function () {
    lt.open("pricing", { cc: lt.userCountry });
  });
  this.$root.find(".bt-premium-later").on("tap", function () {
    a.showView(lt.game.GameView.GAME_PLAY);
  });
};
lt.game.PointerAni = function (a) {
  uix.Animation.call(this);
  this.canvas = a;
  this.ctx = a.getContext("2d");
  this.rgb = getRGB($(a).css("color")) || [255, 255, 255];
  this.fps = 24;
  this.cc = 0;
  this.width = a.width;
  this.height = a.height;
  this.ctx.scale(
    this.width / lt.game.PointerAni.WIDTH,
    this.height / lt.game.PointerAni.HEIGHT
  );
};
lt.game.PointerAni.WIDTH = 40;
lt.game.PointerAni.HEIGHT = 40;
lt.game.PointerAni.SHAPE = { arcs: 3, radius: 12, width: 4, margin: 9 };
lt.game.PointerAni.prototype = new uix.Animation();
lt.game.PointerAni.prototype.constructor = lt.game.PointerAni;
lt.game.PointerAni.prototype.play = function () {
  uix.Animation.prototype.play.call(this);
  this.paint();
};
lt.game.PointerAni.prototype.stop = function () {
  uix.Animation.prototype.stop.call(this);
};
lt.game.PointerAni.prototype.loop = function () {
  this.ctx.translate(
    lt.game.PointerAni.WIDTH / 2,
    lt.game.PointerAni.HEIGHT / 2
  );
  this.ctx.rotate((180 * Math.PI) / (180 * this.fps));
  this.ctx.translate(
    -lt.game.PointerAni.WIDTH / 2,
    -lt.game.PointerAni.HEIGHT / 2
  );
  this.paint();
};
lt.game.PointerAni.prototype.paint = function () {
  this.ctx.clearRect(0, 0, this.width, this.height);
  var a = lt.game.PointerAni.WIDTH / 2,
    b = lt.game.PointerAni.HEIGHT / 2,
    c = lt.game.PointerAni.SHAPE.radius,
    d = (2 * Math.PI) / lt.game.PointerAni.SHAPE.arcs,
    e = (lt.game.PointerAni.SHAPE.margin * Math.PI) / 180;
  this.ctx.lineWidth = lt.game.PointerAni.SHAPE.width;
  this.ctx.strokeStyle = "rgb(" + this.rgb.join() + ")";
  for (var f = 0; f < lt.game.PointerAni.SHAPE.arcs; f++)
    this.ctx.beginPath(),
      this.ctx.arc(a, b, c, f * d + e, (f + 1) * d - e),
      this.ctx.stroke();
};
lt.game.ArrowAni = function (a, b, c) {
  uix.Animation.call(this);
  this.canvas = a;
  this.ctx = a.getContext("2d");
  this.dir = b;
  this.rgb = c || getRGB($(a).css("color")) || [255, 255, 255];
  this.fps = 10;
  this.cc = 0;
  this.width = a.width;
  this.height = a.height;
  this.ctx.scale(
    this.width / lt.game.ArrowAni.WIDTH,
    this.height / lt.game.ArrowAni.HEIGHT
  );
};
lt.game.ArrowAni.WIDTH = 44;
lt.game.ArrowAni.HEIGHT = 44;
lt.game.ArrowAni.PATHS = {
  up: {
    t: [12, 24],
    d: [0, -9],
    p: [
      [0.5, 10.5],
      [10.5, 0.5],
      [20.5, 10.5],
      [18.5, 12.5],
      [10.5, 4.5],
      [2.5, 12.5],
    ],
  },
  right: {
    t: [7, 12],
    d: [9, 0],
    p: [
      [2.5, 0.5],
      [12.5, 10.5],
      [2.5, 20.5],
      [0.5, 18.5],
      [8.5, 10.5],
      [0.5, 2.5],
    ],
  },
  down: {
    t: [11, 7],
    d: [0, 9],
    p: [
      [0.5, 2.5],
      [10.5, 12.5],
      [20.5, 2.5],
      [18.5, 0.5],
      [10.5, 8.5],
      [2.5, 0.5],
    ],
  },
  left: {
    t: [24, 11],
    d: [-9, 0],
    p: [
      [10.5, 0.5],
      [0.5, 10.5],
      [10.5, 20.5],
      [12.5, 18.5],
      [4.5, 10.5],
      [12.5, 2.5],
    ],
  },
};
lt.game.ArrowAni.ALPHAS = [0.25, 0.25, 0.25, 1, 0.75, 0.5];
lt.game.ArrowAni.prototype = new uix.Animation();
lt.game.ArrowAni.prototype.constructor = lt.game.ArrowAni;
lt.game.ArrowAni.prototype.stop = function () {
  uix.Animation.prototype.stop.call(this);
  this.cc = 0;
  this.paint();
};
lt.game.ArrowAni.prototype.loop = function () {
  this.paint();
  5 < ++this.cc && (this.cc = 0);
};
lt.game.ArrowAni.prototype.paint = function () {
  this.ctx.clearRect(0, 0, this.width, this.height);
  for (
    var a = lt.game.ArrowAni.PATHS[this.dir],
      b = "rgba(" + this.rgb.join() + ",",
      c = 0,
      d;
    3 > c;
    c++
  )
    (d = (this.cc + 2 - c) % 6),
      this.paintArrow(
        this.ctx,
        a.t[0] + a.d[0] * c,
        a.t[1] + a.d[1] * c,
        b + lt.game.ArrowAni.ALPHAS[d] + ")"
      );
};
lt.game.ArrowAni.prototype.paintArrow = function (a, b, c, d) {
  var e = lt.game.ArrowAni.PATHS[this.dir].p;
  a.beginPath();
  a.moveTo(b + e[0][0], c + e[0][1]);
  for (var f = 1; f < e.length; f++) a.lineTo(b + e[f][0], c + e[f][1]);
  a.closePath();
  a.fillStyle = d;
  a.fill();
};
$.fn.arrowAni = function (a) {
  return this.each(function () {
    var b = $(this);
    if (null == a)
      b.data("arrow-ani", new lt.game.ArrowAni(this, b.data("dir")));
    else b.data("arrow-ani")[a]();
  });
};
lt.game.ReportErrorDialog = function (a) {
  this.page = a;
  this.$root = $("#report-error-dialog");
  this.$form = $("#report-error-form");
  var b = this;
  this.$root.find("button.close").on("tap", function () {
    b.close();
  });
  this.$form.submit(function (a) {
    b.send($(this));
    a.preventDefault();
    return !1;
  });
};
lt.game.ReportErrorDialog.prototype.open = function () {
  null == lt.user
    ? uix.Dialog.showMessageDialog({
        type: "warn",
        text1: "Sorry, to report an error you must be a registered user.",
        actions: [
          {
            text: "Close",
            tap: function () {
              $(this).uix("dialog", "close");
            },
          },
        ],
      })
    : this.$root.uix("dialog", "show");
};
lt.game.ReportErrorDialog.prototype.close = function () {
  this.$root.uix("dialog", "hide");
};
lt.game.ReportErrorDialog.prototype.send = function (a) {
  uix.Form.clearErrors(a);
  if (!this.validate(a)) return !1;
  var b = this;
  a = {
    id: this.page.lyrics.id,
    error: a.find("[name\x3derror-cause]").val(),
    desc: a.find("[name\x3derror-desc]").val(),
    time: this.page.videoPlayer.currentTime,
  };
  this.page.exercise && (a.mode = this.page.exercise.mode);
  $.ajax({
    url: "/api/report_error",
    data: a,
    type: "POST",
    dataType: "json",
    success: function (a, d, e) {
      b.close();
      uix.Dialog.showMessageDialog({
        type: "done",
        text1: "Thank you very much for your help!",
        actions: [
          {
            text: "Close",
            tap: function () {
              $(this).uix("dialog", "close");
            },
          },
        ],
      });
    },
    error: function (a, d, e) {
      b.close();
      lt.showErrorMessage();
    },
    complete: function (a, d) {
      b.toggleLoading(!1);
    },
  });
  this.toggleLoading(!0);
};
lt.game.ReportErrorDialog.prototype.validate = function (a) {
  var b = a.find("[name\x3derror-cause]");
  if ("" === b.val())
    return uix.Form.showError(b, "Please select a cause from the list."), !1;
  a = a.find("[name\x3derror-desc]");
  return "" === a.val() && "other" === b.val()
    ? (uix.Form.showError(
        a,
        "Please write a short description of the problem."
      ),
      !1)
    : !0;
};
lt.game.ReportErrorDialog.prototype.toggleLoading = function (a) {
  var b = this.$form.find("button[type\x3dsubmit]");
  a ? b.uix("button", "disable", "Sending...") : b.uix("button", "enable");
};
lt.game.SoftKeyboard = function (a, b) {
  this.layout = lt.game.SoftKeyboard.LAYOUTS[a];
  this.handler = b;
  this.$root = null;
  this.visible = !1;
  this.setup();
};
lt.game.SoftKeyboard.LAYOUTS = {
  en: [
    "Q1:1/Q W2:2/W E3:\u00eb3\u00ea/\u00e8E\u00e9 R4:4/R T5:5/T Y6:6/Y U7:7\u00fc/U\u00fb I8:8\u00ef/I\u00ee O9:\u01539\u00f6/\u00f4O\u00f3 P0:0/P".split(
      " "
    ),
    "A:\u00e0\u00e5/A\u00e2/\u00e4\u00e6 S D F G H J K L".split(" "),
    "Z X C:\u00e7/C V B N M".split(" "),
  ],
  es: [
    "Q1:1/Q;W2:2/W;E3:3 /E\u00e9;R4:4/R;T5:5/T;Y6:6/Y;U7:7\u00fc/U\u00fa;I8:8\u00ef/I\u00ed;O9:9 /O\u00f3;P0:0/P".split(
      ";"
    ),
    "A:\u00e1/A S D F G H J K L \u00d1".split(" "),
    "ZXCVBNM".split(""),
  ],
  pt: [
    "Q1:1/Q;W2:2/W;E3:3\u00ea/E\u00e9;R4:4/R;T5:5/T;Y6:6/Y;U7:7 /U\u00fa;I8:8 /I\u00ed;O9: 9\u00f5/\u00f4O\u00f3;P0:0/P".split(
      ";"
    ),
    "A:\u00e1\u00e3/A\u00e0/\u00e2 ;S;D;F;G;H;J;K;L;\u00c7".split(";"),
    "ZXCVBNM".split(""),
  ],
  fr: [
    "A1:1\u00e6/A\u00e0/\u00e2 ;Z2:2/Z;E3:\u00eb3\u00ea/\u00e8E\u00e9;R4:4/R;T5:5/T;Y6:6 /Y\u00ff;U7: 7\u00fc/\u00fbU\u00f9;I8:8\u00ef/I\u00ee;O9:9\u0153/O\u00f4;P0:0/P;\u00c9".split(
      ";"
    ),
    "QSDFGHJKLM\u00d9".split(""),
    "WXCVBN\u00c8\u00c0\u00c7".split(""),
  ],
  it: [
    "Q1:1/Q;W2:2/W;E3:3\u00e8/E\u00e9;R4:4/R;T5:5/T;Y6:6/Y;U7:7 /U\u00f9;I8:8\u00ee/I\u00ec;O9:9\u00f2/O\u00f3;P0:0/P;\u00c8".split(
      ";"
    ),
    "A:\u00e0/A S D F G H J K L \u00d2 \u00c0".split(" "),
    "ZXCVBNM\u00d9".split(""),
  ],
  de: [
    "Q1:1/Q;W2:2/W;E3:3/E;R4:4/R;T5:5/T;Z6:6/Z;U7:7 /U\u00fc;I8:8/I;O9:9 /O\u00f6;P0:0/P;\u00dc".split(
      ";"
    ),
    "A:\u00e4/A S D F G H J K L \u00d6 \u00c4".split(" "),
    "YXCVBNM\u00df".split(""),
  ],
  nl2: [
    "Q1:1/Q W2:2/W E3:\u00eb3\u00ea/\u00e8E\u00e9 R4:4/R T5:5/T Y6:6/Y U7:\u00fc7\u00fb/\u00f9U\u00fa I8:\u00ef8\u00ee/\u00ecI\u00ed O9:\u00f69\u00f4/\u00f2O\u00f3 P0:0/P".split(
      " "
    ),
    "A:\u00e1\u00e4/A\u00e0/\u00e2 ;S;D;F;G;H;J;K;L".split(";"),
    "ZXCVBNM".split(""),
  ],
  zh: [
    "Q1:1/Q W2:2/W E3:\u011b3\u0113/\u00e8E\u00e9 R4:4/R T5:5/T Y6:6/Y U7:\u01d47\u016b/\u00f9U\u00fa I8:\u01d08\u012b/\u00ecI\u00ed O9:\u01d29\u014d/\u00f2O\u00f3 P0:0/P".split(
      " "
    ),
    "A:\u00e0\u01ce/A\u00e1/\u0101 S D F G H J K L".split(" "),
    "Z X C V:\u01da\u00fc\u01d6/\u01dcV\u01d8 B N M".split(" "),
  ],
  ja: [
    "Q1:1/Q W2:2/W E3:3/E R4:4/R T5:5/T Y6:6/Y U7:7/U I8:8/I O9:9/O P0:0/P".split(
      " "
    ),
    "ASDFGHJKL".split(""),
    "ZXCVBNM".split(""),
  ],
  ko: [
    "Q1:1/Q W2:2/W E3:3/E R4:4/R T5:5/T Y6:6/Y U7:7/U I8:8/I O9:9/O P0:0/P".split(
      " "
    ),
    "ASDFGHJKL".split(""),
    "ZXCVBNM".split(""),
  ],
  tr: [
    "Q1:1/Q W2:2/W E3:3/E R4:4/R T5:5/T Y6:6/Y U7:7/U\u00fb I8:8/I\u00ee O9:9/O P0:0/P \u011e \u00dc".split(
      " "
    ),
    "A:\u00e2/A S D F G H J K L \u015e \u0130".split(" "),
    "ZXCVBNM\u00d6\u00c7".split(""),
  ],
  pl: [
    "Q1:1/Q W2:2/W E3:3/E\u0119 R4:4/R T5:5/T Y6:6/Y U7:7/U I8:8/I O9:9/O\u00f3 P0:0/P".split(
      " "
    ),
    "A:\u0105/A S:\u015b/S D F G H J K L:\u0142/L".split(" "),
    "Z:\u017a/Z\u017c X C:\u0107/C V B N:\u0144/N M".split(" "),
  ],
  ro: [
    "Q1:1/Q W2:2/W E3:3/E R4:4/R T5:5/T\u021b Y6:6/Y U7:7/U I8:8/I\u00ee O9:9/O P0:0/P".split(
      " "
    ),
    "A:\u00e2/A\u0103 S:\u0219/S D F G H J K L".split(" "),
    "ZXCVBNM".split(""),
  ],
  cs: [
    "Q1:1/Q W2:2/W E3:3\u011b/E\u00e9 R4:4/R\u0159 T5:5/T\u0165 Z6:6/Z\u017e U7:7\u016f/U\u00fa I8:8/I\u00ed O9:9/O\u00f3 P0:0/P".split(
      " "
    ),
    "A:\u00e1/A S:\u0161/S D:\u010f/D F G H J K L".split(" "),
    "Y:\u00fd/Y X C:\u010d/C V B N:\u0148/N M".split(" "),
  ],
  sv: [
    "Q1:1/Q W2:2/W E3:3\u00e8/E\u00e9 R4:4/R T5:5/T Y6:6/Y U7:7/U\u00fc I8:8/I\u00ed O9:9/O P0:0/P \u00c5".split(
      " "
    ),
    "A:\u00e1/A S D F G H J K L \u00d6:\u00f8/\u00d6 \u00c4:\u00e6/\u00c4".split(
      " "
    ),
    "Z X C V B N:\u00f1/N M".split(" "),
  ],
  fi: [
    "Q1:1/Q W2:2/W E3:3\u00e8/E\u00e9 R4:4/R T5:5/T Y6:6/Y U7:7/U\u00fc I8:8/I\u00ed O9:9/O P0:0/P \u00c5".split(
      " "
    ),
    "A:\u00e1/A S:\u0161/S D F G H J K L \u00d6:\u00f8/\u00d6 \u00c4:\u00e6/\u00c4".split(
      " "
    ),
    "Z:\u017e/Z X C V B N:\u00f1/N M".split(" "),
  ],
  ca: [
    "Q1:1/Q W2:2/W E3:3\u00e8/E\u00e9 R4:4/R T5:5/T Y6:6/Y U7:7\u00fc/U\u00fa I8:8\u00ef/I\u00ed O9:9\u00f2/O\u00f3 P0:0/P".split(
      " "
    ),
    "A:\u00e0/A\u00e1 S D F G H J K L \u00c7".split(" "),
    "Z X C V B N:\u00f1/N M".split(" "),
  ],
};
lt.game.SoftKeyboard.prototype.setup = function () {
  this.$root = this.render();
  var a = this,
    b = this.$root.find(".kb-overlay");
  this.$root.on(
    {
      tapstart: function (a) {
        a = $(this);
        a.hasClass("press") || a.classTo(null, "press", 0.1);
      },
      tapend: function (b) {
        b = $(this);
        if (b.hasClass("press")) {
          if (b.hasClass("kb-hide")) a.handler.hide();
          else {
            var d = b.data("alt-key");
            null == d && (d = b.find("\x3e b").text());
            a.handler.press(d);
          }
          b.kill(!0).classTo("press", null, 1);
        }
      },
      press: function (a) {
        a = $(this);
        var d = a.find(".kb-alt-map");
        0 < d.length &&
          (b.show(),
          d.show().find(".kb-default").addClass("hover"),
          a.on("drag", function (a) {
            a = a.originalEvent.detail;
            a = $(
              document.elementFromPoint(
                a.x - window.pageXOffset,
                a.y - window.pageYOffset
              )
            );
            if (a.is(".kb-alt-key")) {
              var b = $(this);
              k0 = b.data("alt-key");
              k = a.text();
              " " !== k &&
                k != k0 &&
                (null != k0 && b.find(".kb-alt-key.hover").removeClass("hover"),
                b.data("alt-key", k),
                a.addClass("hover"));
            }
          }),
          $(document).on("tapend.kb-alt", a, function (a) {
            a = a.data;
            $(document).off("tapend.kb-alt");
            a.off("drag")
              .removeData("alt-key")
              .find(".kb-alt-map")
              .hide()
              .find(".kb-alt-key.hover")
              .removeClass("hover");
            b.hide();
          }));
      },
      mouseenter: function (a) {
        a = $(this);
        a.hasClass("hover") || a.classTo(null, "hover", 0.1);
      },
      mouseleave: function (a) {
        a = $(this);
        a.hasClass("hover") &&
          (a.hasClass("press")
            ? a.kill(!0).classTo("press hover", null, 1)
            : a.classTo("hover", null, 0.1));
      },
    },
    ".kb-key"
  );
  this.$root.on("touchstart mousedown", function (a) {
    a.preventDefault();
  });
};
lt.game.SoftKeyboard.prototype.render = function () {
  var a = $("\x3cdiv id\x3d'soft-keyboard'\x3e");
  10 < this.layout[0].length && a.addClass("kb-large");
  for (var b = 0, c; b < this.layout.length; b++) {
    c = $("\x3cdiv class\x3d'kb-row'\x3e").appendTo(a);
    for (var d = 0, e, f, l; d < this.layout[b].length; d++)
      if (
        ((e = this.layout[b][d].split(":")),
        (f = e[0].charAt(0)),
        (l = $("\x3cdiv class\x3d'kb-key'\x3e").appendTo(c)),
        l.append("\x3cb\x3e" + f + "\x3c/b\x3e"),
        1 < e[0].length &&
          l.append("\x3ci\x3e" + e[0].charAt(1) + "\x3c/i\x3e"),
        1 < e.length)
      ) {
        var h = 0,
          p = 0,
          g = "";
        e = e[1].split("/");
        for (var m = 0; m < e.length; m++) {
          for (var g = g + "\x3ctr\x3e", n = 0, q; n < e[m].length; n++)
            (q = e[m].charAt(n)),
              (g += "\x3ctd class\x3d'kb-alt-key"),
              q === f &&
                ((g += " kb-default"),
                (h = 0 !== m ? "-" + m + "00%" : 0),
                (p = 0 !== n ? "-" + n + "00%" : 0)),
              (g += "'\x3e" + q + "\x3c/td\x3e");
          g += "\x3c/tr\x3e";
        }
        $(
          "\x3ctable class\x3d'kb-alt-map' cellpadding\x3d'0' cellspacing\x3d'0' style\x3d'top: " +
            h +
            "; left: " +
            p +
            ";'\x3e" +
            g +
            "\x3c/table\x3e"
        ).appendTo(l);
      }
  }
  $(
    "\x3cdiv class\x3d'kb-key kb-hide'\x3e\x3cspan class\x3d'uix-icon uix-icon-keyboard-down'\x3e\x3c/span\x3e\x3c/div\x3e"
  ).appendTo(c);
  $("\x3cdiv class\x3d'kb-overlay'\x3e").appendTo(a);
  $(document.body).append(a);
  return a;
};
lt.game.SoftKeyboard.prototype.toggle = function (a) {
  a
    ? this.visible ||
      (uix.effects.slideIn(this.$root, { dir: "up" }), (this.visible = !0))
    : this.visible &&
      (uix.effects.slideOut(this.$root, { dir: "down" }), (this.visible = !1));
};
