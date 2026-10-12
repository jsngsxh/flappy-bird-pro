// 好友排行榜 - 开放数据域
var sharedCanvas = wx.getSharedCanvas();
var ctx = sharedCanvas.getContext('2d');
var friends = [];
var scrollY = 0;
var W = 400, H = 600;

sharedCanvas.width = W;
sharedCanvas.height = H;

function drawRoundedRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function render() {
  ctx.clearRect(0, 0, W, H);

  ctx.fillStyle = 'rgba(0,0,0,0.85)';
  drawRoundedRect(0, 0, W, H, 0);
  ctx.fill();

  if (!friends || friends.length === 0) {
    ctx.font = 'bold 16px Arial'; ctx.textAlign = 'center';
    ctx.fillStyle = '#AAA'; ctx.fillText('暂无好友数据', W / 2, H / 2);
    ctx.fillStyle = '#888'; ctx.font = '13px Arial';
    ctx.fillText('需要微信好友也玩过本游戏', W / 2, H / 2 + 35);
    ctx.textAlign = 'start';
    return;
  }

  var itemH = 50, startY = 80 - scrollY;

  for (var i = 0; i < friends.length; i++) {
    var f = friends[i];
    var y = startY + i * itemH;
    // 可视区域裁剪
    if (y + itemH < 70 || y > H) continue;

    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.08)';
    drawRoundedRect(15, y, W - 30, itemH - 5, 8);
    ctx.fill();

    ctx.font = 'bold 20px Arial'; ctx.textAlign = 'center';
    ctx.fillStyle = '#FFF';
    var rankText = '' + (i + 1);
    if (i === 0) rankText = '🥇';
    else if (i === 1) rankText = '🥈';
    else if (i === 2) rankText = '🥉';
    ctx.fillText(rankText, 30, y + 32);

    ctx.fillStyle = '#555';
    ctx.beginPath(); ctx.arc(85, y + 25, 16, 0, Math.PI * 2); ctx.fill();
    if (f.avatarUrl) {
      var img = wx.createImage();
      img.src = f.avatarUrl;
      img.onload = function() {
        ctx.save();
        ctx.beginPath(); ctx.arc(85, y + 25, 16, 0, Math.PI * 2); ctx.clip();
        ctx.drawImage(img, 69, y + 9, 32, 32);
        ctx.restore();
      };
    }

    ctx.font = 'bold 15px Arial'; ctx.textAlign = 'left';
    ctx.fillStyle = '#FFF';
    var name = f.nickname || '未知玩家';
    if (name.length > 6) name = name.substring(0, 5) + '…';
    ctx.fillText(name, 110, y + 30);

    var kv = f.KVDataList || [];
    var score = 0;
    for (var k = 0; k < kv.length; k++) {
      if (kv[k].key === 'bestScore') { score = parseInt(kv[k].value) || 0; break; }
    }
    ctx.fillStyle = '#FFD740'; ctx.font = 'bold 18px Arial'; ctx.textAlign = 'center';
    ctx.fillText('' + score, 300, y + 30);
  }

  ctx.textAlign = 'start';
}

wx.onMessage(function(data) {
  if (data.type === 'updateRank') {
    if (wx.getRankManager) {
      wx.getRankManager({
        keyList: ['bestScore'],
        success: function(res) {
          friends = (res.data || []).sort(function(a, b) {
            var sa = 0, sb = 0;
            (a.KVDataList || []).forEach(function(k) { if (k.key === 'bestScore') sa = parseInt(k.value) || 0; });
            (b.KVDataList || []).forEach(function(k) { if (k.key === 'bestScore') sb = parseInt(k.value) || 0; });
            return sb - sa;
          });
          render();
        },
        fail: function() {
          wx.getFriendCloudStorage({
            keyList: ['bestScore'],
            success: function(res2) {
              friends = (res2.data || []).sort(function(a, b) {
                var sa = 0, sb = 0;
                (a.KVDataList || []).forEach(function(k) { if (k.key === 'bestScore') sa = parseInt(k.value) || 0; });
                (b.KVDataList || []).forEach(function(k) { if (k.key === 'bestScore') sb = parseInt(k.value) || 0; });
                return sb - sa;
              });
              render();
            },
            fail: function() { render(); }
          });
        }
      });
    } else {
      wx.getFriendCloudStorage({
        keyList: ['bestScore'],
        success: function(res) {
          friends = (res.data || []).sort(function(a, b) {
            var sa = 0, sb = 0;
            (a.KVDataList || []).forEach(function(k) { if (k.key === 'bestScore') sa = parseInt(k.value) || 0; });
            (b.KVDataList || []).forEach(function(k) { if (k.key === 'bestScore') sb = parseInt(k.value) || 0; });
            return sb - sa;
          });
          render();
        },
        fail: function() { render(); }
      });
    }
  }
  if (data.type === 'scroll') {
    scrollY = data.scrollY || 0;
    render();
  }
});
