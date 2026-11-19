$('document').ready(
  function() {
    $.ajax({
      url: "data/tweets.json",
      dataType: "json",
      success: function(obj) {
          console.log(obj);
        for (var i=0;i<obj.length;i++){
          let emoji = printEmojis(obj[i].text);
          if(emoji != null){
            let category = obj[i].entities.hashtags[0].text;
            let tweetId = 'tweet-' + i;
            $('#result').append(
              $('<p class="'+category+' tweets" id="'+tweetId+'">' + obj[i].text + '</p>').hide()
            );

            let aTag = $('<a>#' + category + '<a>');
            aTag.click(() => {
              filterContent(category);
            })
            $('#hashtag').append(aTag);

            let emojiSpan = $('<span class="'+category+' emoji" data-target="'+tweetId+'">'+emoji.join('')+'</span>');
            emojiSpan.hover(
              function(){ $('#'+$(this).data('target')).show(); },
              function(){ $('#'+$(this).data('target')).hide(); }
            );
            $('#emoji').append(emojiSpan);
          }
        }
      },
      error: function(err) {
        console.log(err);
      }
    })
  }
)


function filterContent(target){
  $('.emoji').each(function(){
    console.log(this);
    console.log($(this).hasClass(target));
    if(!$(this).hasClass(target)){
      $(this).hide();
    }else{
      $(this).show();
    }
  })
  $('.tweets').each(function(){
    console.log(this);
    console.log($(this).hasClass(target));
    if(!$(this).hasClass(target)){
      $(this).hide();
    }else{
      $(this).show();
    }
  })

}

function printEmojis (twittertext) {
  var regex = /(?:[\u2700-\u27bf]|(?:\ud83c[\udde6-\uddff]){2}|[\ud800-\udbff][\udc00-\udfff]|[\u0023-\u0039]\ufe0f?\u20e3|\u3299|\u3297|\u303d|\u3030|\u24c2|\ud83c[\udd70-\udd71]|\ud83c[\udd7e-\udd7f]|\ud83c\udd8e|\ud83c[\udd91-\udd9a]|\ud83c[\udde6-\uddff]|[\ud83c[\ude01\uddff]|\ud83c[\ude01-\ude02]|\ud83c\ude1a|\ud83c\ude2f|[\ud83c[\ude32\ude02]|\ud83c\ude1a|\ud83c\ude2f|\ud83c[\ude32-\ude3a]|[\ud83c[\ude50\ude3a]|\ud83c[\ude50-\ude51]|\u203c|\u2049|[\u25aa-\u25ab]|\u25b6|\u25c0|[\u25fb-\u25fe]|\u00a9|\u00ae|\u2122|\u2139|\ud83c\udc04|[\u2600-\u26FF]|\u2b05|\u2b06|\u2b07|\u2b1b|\u2b1c|\u2b50|\u2b55|\u231a|\u231b|\u2328|\u23cf|[\u23e9-\u23f3]|[\u23f8-\u23fa]|\ud83c\udccf|\u2934|\u2935|[\u2190-\u21ff])/g;

  return(twittertext.match(regex));
}
